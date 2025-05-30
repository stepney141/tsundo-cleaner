import { TfIdf } from 'natural';
import { getDatabase, DatabaseType } from '../config/database';
import { Book, BookType } from '../../../shared/types/Book';
import { ValidationError, NotFoundError, validateBookType } from '../utils/errorHandler';
import { convertToAppModel } from './bookService';
import { getEmbedding, calculateCosineSimilarity } from './openaiService';
import * as embeddingCache from './embeddingCache';

/**
 * データベースモデル（DBに格納されている形式）
 */
interface BookDB {
  bookmeter_url: string;
  isbn_or_asin: string;
  book_title: string;
  author: string;
  publisher: string;
  published_date: string;
  exist_in_Sophia: string;       // 'Yes'/'No'
  exist_in_UTokyo: string;       // 'Yes'/'No'
  sophia_opac?: string;
  utokyo_opac?: string;
  sophia_mathlib_opac?: string;
  description?: string;
}

// 書籍データベース
const bookDb = getDatabase(DatabaseType.BOOKS);

/**
 * 書籍の説明文から埋め込みベクトルを取得（キャッシュ対応）
 * @param book 対象の書籍
 * @returns 埋め込みベクトル
 */
export const getBookEmbedding = async (book: Book): Promise<number[]> => {
  try {
    // キャッシュから取得を試みる
    const cachedEmbedding = await embeddingCache.getEmbedding(book.bookmeter_url);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }
    
    // 説明文がない場合はタイトルと著者を組み合わせて使用
    const textForEmbedding = book.description && book.description.trim() !== '' 
      ? book.description
      : `${book.book_title} by ${book.author}`;
    
    // OpenAI API から埋め込みベクトルを取得
    const embedding = await getEmbedding(textForEmbedding);
    
    // キャッシュに保存
    await embeddingCache.saveEmbedding(book.bookmeter_url, embedding);
    
    return embedding;
  } catch (error) {
    console.error(`書籍 ${book.book_title} の埋め込みベクトル取得に失敗:`, error);
    throw error;
  }
};

/**
 * 指定された書籍に類似した書籍を取得
 * @param referenceBookUrl 類似書籍を検索する基準となる書籍のURL
 * @param type 検索対象の書籍タイプ（wish/stacked）
 * @param limit 取得する類似書籍の最大数
 */
export const getSimilarBooks = async (
  referenceBookUrl: string,
  type: BookType = 'wish',
  limit: number = 5
): Promise<Book[]> => {
  // 書籍タイプのバリデーション
  validateBookType(type);

  if (!referenceBookUrl) {
    throw new ValidationError('書籍URLは必須です');
  }

  try {
    // 基準となる書籍を取得
    const referenceBooks = await bookDb.query<BookDB>(
      `SELECT * FROM ${type} WHERE bookmeter_url = ?`,
      [referenceBookUrl]
    );

    if (referenceBooks.length === 0) {
      throw new NotFoundError('指定された書籍が見つかりませんでした');
    }

    const referenceDbBook = referenceBooks[0];
    const referenceBook = convertToAppModel(referenceDbBook);
    
    // データベース側でフィルタリングして比較対象の書籍を取得
    // 注：OpenAI Embeddingsを使用する場合は説明文がなくてもタイトルと著者を使用できるため、
    // 説明文フィルタを削除
    const targetDbBooks = await bookDb.query<BookDB>(
      `SELECT * FROM ${type} 
       WHERE bookmeter_url != ?
       LIMIT 100`, // パフォーマンス向上のため上限を設定
      [referenceBookUrl]
    );
    
    const targetBooks = targetDbBooks.map(book => convertToAppModel(book));

    try {
      // OpenAI Embeddingsを使用した類似度計算
      return await findSimilarByEmbeddings(referenceBook, targetBooks, limit);
    } catch (embeddingError) {
      console.warn('OpenAI Embeddings APIによる類似度計算に失敗しました。TF-IDFにフォールバックします。', embeddingError);
      
      // 説明文がない場合はタイトルと著者で検索
      if (!referenceBook.description || referenceBook.description.trim() === '') {
        return findSimilarByTitleAndAuthor(referenceBook, targetBooks.filter(book => 
          book.description && book.description.trim() !== ''), limit);
      }
      
      // TF-IDFを使った類似度計算（フォールバック）
      return findSimilarByDescription(referenceBook, targetBooks.filter(book => 
        book.description && book.description.trim() !== ''), limit);
    }
  } catch (err) {
    console.error(`getSimilarBooks(${referenceBookUrl}, ${type})でエラーが発生しました:`, err);
    throw err;
  }
};

/**
 * OpenAI Embeddingsを使って類似書籍を見つける
 */
export const findSimilarByEmbeddings = async (
  referenceBook: Book,
  targetBooks: Book[],
  limit: number
): Promise<Book[]> => {
  if (targetBooks.length === 0) {
    return [];
  }
  
  try {
    // 基準書籍の埋め込みベクトルを取得
    const referenceEmbedding = await getBookEmbedding(referenceBook);
    
    // 各書籍の埋め込みベクトルを取得し、類似度を計算
    const similarityScores = await Promise.all(
      targetBooks.map(async (book) => {
        try {
          const embedding = await getBookEmbedding(book);
          const similarity = calculateCosineSimilarity(referenceEmbedding, embedding);
          return { book, score: similarity };
        } catch (error) {
          console.error(`書籍 ${book.book_title} の類似度計算中にエラーが発生:`, error);
          return { book, score: -1 }; // エラー時は最低スコア
        }
      })
    );
    
    // スコアの高い順にソートして上位limit件を返す（エラーの場合は除外）
    return similarityScores
      .filter(item => item.score >= 0) // エラーとなった書籍を除外
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.book);
  } catch (error) {
    console.error('埋め込みベクトルによる類似度計算中にエラーが発生:', error);
    throw error;
  }
};

/**
 * 説明文を使って類似書籍を見つける（TF-IDF）
 * 一度に全ての文書のTF-IDFを計算し、効率化
 */
export const findSimilarByDescription = (
  referenceBook: Book,
  targetBooks: Book[],
  limit: number
): Book[] => {
  // 説明文のない書籍をフィルタリング
  const validTargetBooks = targetBooks.filter(book => 
    book.description && book.description.trim() !== ''
  );
  
  if (validTargetBooks.length === 0) {
    return [];
  }
  
  const tfidf = new TfIdf();

  // まず全ての説明文をTF-IDFに追加（基準書籍を最初に）
  tfidf.addDocument(referenceBook.description || '');
  validTargetBooks.forEach(book => {
    tfidf.addDocument(book.description || '');
  });

  // 類似度スコアの計算をバッチ処理で行う
  const terms = extractKeyTerms(referenceBook.description || '');
  const similarityScores = validTargetBooks.map((book, index) => {
    const docIndex = index + 1; // +1は基準書籍がインデックス0だから
    
    // 重要な単語のみを使って類似度を計算し、計算量を削減
    let score = 0;
    terms.forEach(term => {
      const similarity = tfidf.tfidf(term, docIndex);
      score += similarity;
    });
    
    return { book, score };
  });

  // スコアの高い順にソートして上位limit件を返す
  return similarityScores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.book);
};

/**
 * 文章から重要な単語を抽出する
 */
export const extractKeyTerms = (text: string, maxTerms: number = 20): string[] => {
  // 単語に分割して、短すぎる単語や一般的すぎる単語を除外
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '') // 記号を除去
    .split(/\s+/)
    .filter(word => word.length > 2) // 3文字以上の単語のみ
    .filter(word => !['the', 'and', 'for', 'with', 'this', 'that'].includes(word));
  
  // 重複を除去して最大maxTerms件返す
  return [...new Set(words)].slice(0, maxTerms);
};

/**
 * タイトルと著者を使って類似書籍を見つける（説明文がない場合の代替手段）
 */
export const findSimilarByTitleAndAuthor = (
  referenceBook: Book,
  targetBooks: Book[],
  limit: number
): Book[] => {
  // 簡易的な類似度計算（単語の一致度）
  const similarityScores = targetBooks.map(book => {
    let score = 0;
    
    // タイトルの単語一致を計算
    const refTitle = referenceBook.book_title.toLowerCase();
    const targetTitle = book.book_title.toLowerCase();
    const refTitleWords = refTitle.split(/\s+/);
    const targetTitleWords = targetTitle.split(/\s+/);
    
    // タイトルの単語が一致するごとにスコア加算
    refTitleWords.forEach(word => {
      if (targetTitleWords.includes(word)) {
        score += 3; // タイトル一致は重み付け
      }
    });
    
    // 著者一致でスコア加算
    if (referenceBook.author === book.author) {
      score += 5; // 著者一致は重要
    }
    
    // 出版社一致でスコア加算
    if (referenceBook.publisher === book.publisher) {
      score += 2;
    }
    
    return { book, score };
  });
  
  // スコアの高い順にソートして上位limit件を返す
  return similarityScores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.book);
};
