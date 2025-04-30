import { getDatabase, DatabaseType } from '../config/database';
import { Book, BookType, PaginatedResult, PaginationParams } from '../../../shared/types/Book';
import { NotFoundError, ValidationError, validateBookType } from '../utils/errorHandler';
import { getEmbedding, calculateCosineSimilarity } from './openaiService';
import * as embeddingCache from './embeddingCache';

// 書籍データベース
const bookDb = getDatabase(DatabaseType.BOOKS);

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

/**
 * DBモデルをアプリケーションモデルに変換する純粋関数
 */
export const convertToAppModel = (dbBook: BookDB): Book => ({
  ...dbBook,
  exist_in_Sophia: dbBook.exist_in_Sophia === 'Yes',
  exist_in_UTokyo: dbBook.exist_in_UTokyo === 'Yes'
});

/**
 * アプリケーションモデルをDBモデルに変換する純粋関数
 */
export const convertToDBModel = (book: Book): BookDB => ({
  ...book,
  exist_in_Sophia: book.exist_in_Sophia ? 'Yes' : 'No',
  exist_in_UTokyo: book.exist_in_UTokyo ? 'Yes' : 'No'
});

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
 * 指定されたタイプの書籍を取得する関数（ページネーション対応）
 */
export const getAllBooks = async (
  type: BookType,
  pagination?: PaginationParams
): Promise<PaginatedResult<Book>> => {
  // 書籍タイプのバリデーション
  validateBookType(type);
  
  const page = pagination?.page || 1;
  const limit = pagination?.limit || 10;
  
  try {
    // ページネーション付きクエリの実行
    const result = await bookDb.queryWithPagination<BookDB>(type, page, limit);
    
    // アプリケーションモデルに変換
    const items = result.items.map(convertToAppModel);
    
    return {
      items,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      currentPage: page,
      hasNextPage: page < result.totalPages,
      hasPrevPage: page > 1
    };
  } catch (err) {
    console.error(`getAllBooks(${type})でエラーが発生しました:`, err);
    throw err;
  }
};

/**
 * URLに基づいて特定の書籍を取得する関数
 */
export const getBookByUrl = async (
  type: BookType,
  url: string
): Promise<Book> => {
  // 書籍タイプのバリデーション
  validateBookType(type);
  
  if (!url) {
    throw new ValidationError('書籍URLは必須です');
  }
  
  try {
    // 必要なカラムのみを選択するようにクエリを最適化
    const books = await bookDb.query<BookDB>(
      `SELECT * FROM ${type} WHERE bookmeter_url = ?`,
      [url]
    );
    
    if (books.length === 0) {
      throw new NotFoundError(`URLが ${url} の書籍が見つかりません`);
    }
    
    // アプリケーションモデルに変換して返す
    return convertToAppModel(books[0]);
  } catch (err) {
    console.error(`getBookByUrl(${type}, ${url})でエラーが発生しました:`, err);
    throw err;
  }
};

/**
 * 検索クエリから埋め込みベクトルを使用して書籍を検索する関数
 * OpenAI Embeddingsを使用して意味的な検索を行う
 */
export const searchBooksWithEmbeddings = async (
  type: BookType,
  searchQuery: string,
  books: Book[],
  limit: number = 20
): Promise<Book[]> => {
  if (books.length === 0) {
    return [];
  }

  try {
    // 検索クエリの埋め込みベクトルを取得
    const queryEmbedding = await getEmbedding(searchQuery);
    
    // 各書籍の埋め込みベクトルを取得し、類似度を計算
    const similarityScores = await Promise.all(
      books.map(async (book) => {
        try {
          const embedding = await getBookEmbedding(book);
          const similarity = calculateCosineSimilarity(queryEmbedding, embedding);
          return { book, score: similarity };
        } catch (error) {
          console.error(`書籍 ${book.book_title} の類似度計算中にエラーが発生:`, error);
          return { book, score: -1 }; // エラー時は最低スコア
        }
      })
    );
    
    // スコアの高い順にソート（エラーの場合は除外）
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
 * 検索クエリに基づいて書籍を検索する関数（ページネーション対応）
 * OpenAI Embeddingsを使った類似度検索とSQLのLIKE検索の組み合わせ
 */
export const searchBooks = async (
  type: BookType,
  searchQuery: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Book>> => {
  console.log('bookService.searchBooks 呼び出し:', { type, searchQuery, pagination });
  
  // 書籍タイプのバリデーション
  validateBookType(type);
  
  if (!searchQuery) {
    throw new ValidationError('検索クエリは必須です');
  }
  
  const page = pagination?.page || 1;
  const limit = pagination?.limit || 10;
  
  try {
    // まずはSQL検索で幅広く候補を取得
    const searchTerm = `%${searchQuery}%`;
    const conditions = 'book_title LIKE ? OR author LIKE ? OR publisher LIKE ? OR description LIKE ?';
    const params = [searchTerm, searchTerm, searchTerm, searchTerm];
    
    console.log('SQLクエリ条件:', conditions);
    console.log('SQLクエリパラメータ:', params);
    
    // パフォーマンス向上のため、初期検索の上限を拡大（最大100件）
    const result = await bookDb.queryWithPagination<BookDB>(
      type, 
      1,  // 最初のページのみ
      100, // 最大100件取得
      conditions, 
      params
    );
    
    console.log(`データベース検索結果: ${result.items.length}件 / 全${result.totalItems}件`);
    
    // アプリケーションモデルに変換
    const sqlResults = result.items.map(convertToAppModel);
    
    try {
      // OpenAI Embeddingsを使って類似度でソート
      console.log('Embeddings検索を実行中...');
      const embeddingsResults = await searchBooksWithEmbeddings(type, searchQuery, sqlResults);
      console.log(`Embeddings検索結果: ${embeddingsResults.length}件`);
      
      // ページネーション処理
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedItems = embeddingsResults.slice(startIndex, endIndex);
      
      // 総ページ数を計算
      const totalPages = Math.ceil(embeddingsResults.length / limit);
      
      const paginatedResult = {
        items: paginatedItems,
        totalItems: embeddingsResults.length,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };
      
      console.log('Embeddings検索による結果返却:', {
        totalItems: paginatedResult.totalItems,
        totalPages: paginatedResult.totalPages,
        itemsCount: paginatedResult.items.length
      });
      
      return paginatedResult;
    } catch (embeddingError) {
      // Embeddings検索に失敗した場合は従来のSQL検索結果をそのまま返す
      console.error('Embeddings検索に失敗したためSQL検索結果を返します:', embeddingError);
      
      // SQL検索結果をページネーション処理
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedItems = sqlResults.slice(startIndex, endIndex);
      
      const totalPages = Math.ceil(sqlResults.length / limit);
      
      const paginatedResult = {
        items: paginatedItems,
        totalItems: sqlResults.length,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };
      
      console.log('SQL検索による結果返却:', {
        totalItems: paginatedResult.totalItems,
        totalPages: paginatedResult.totalPages,
        itemsCount: paginatedResult.items.length
      });
      
      return paginatedResult;
    }
  } catch (err) {
    console.error(`searchBooks(${type}, "${searchQuery}")でエラーが発生しました:`, err);
    throw err;
  }
};
