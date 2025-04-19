import { TfIdf } from 'natural';
import { Book, BookType } from '../models/Book';
import { getDatabase, query, closeDatabase } from '../config/database';

/**
 * 書籍の類似度を計算するサービス
 */
export class SimilarityService {
  /**
   * 指定された書籍に類似した書籍を取得
   * @param referenceBookUrl 類似書籍を検索する基準となる書籍のURL
   * @param type 検索対象の書籍タイプ（wish/stacked）
   * @param limit 取得する類似書籍の最大数
   */
  async getSimilarBooks(
    referenceBookUrl: string,
    type: BookType = 'wish',
    limit: number = 5
  ): Promise<Book[]> {
    const db = getDatabase();
    try {
      // 基準となる書籍を取得
      const referenceBooks = await query<Book>(
        db,
        `SELECT * FROM ${type === 'wish' ? 'wish' : 'stacked'} WHERE bookmeter_url = ?`,
        [referenceBookUrl]
      );

      if (referenceBooks.length === 0) {
        throw new Error('指定された書籍が見つかりませんでした');
      }

      const referenceBook = referenceBooks[0];
      
      // 比較対象の書籍を取得（説明文があるもののみ）
      const targetBooks = await query<Book>(
        db,
        `SELECT * FROM ${type} WHERE description IS NOT NULL AND description != '' AND bookmeter_url != ?`,
        [referenceBookUrl]
      );

      // 説明文がない場合はタイトルと著者で検索
      if (!referenceBook.description || referenceBook.description.trim() === '') {
        return this.findSimilarByTitleAndAuthor(referenceBook, targetBooks, limit);
      }

      // TF-IDFを使った類似度計算
      return this.findSimilarByDescription(referenceBook, targetBooks, limit);
    } finally {
      await closeDatabase(db);
    }
  }

  /**
   * 説明文を使って類似書籍を見つける
   */
  private findSimilarByDescription(
    referenceBook: Book,
    targetBooks: Book[],
    limit: number
  ): Book[] {
    const tfidf = new TfIdf();

    // 基準となる書籍の説明文をTF-IDFに追加
    tfidf.addDocument(referenceBook.description || '');

    // 比較対象の書籍をTF-IDFに追加
    targetBooks.forEach((book, index) => {
      if (book.description) {
        tfidf.addDocument(book.description);
      }
    });

    // 類似度スコアを計算（1番目の文書に対する類似度）
    const similarityScores = targetBooks.map((book, index) => {
      // 各書籍の類似度スコアを計算
      let score = 0;
      if (book.description) {
        // TF-IDFの文書インデックスは0からなので、比較対象は1から始まる
        tfidf.tfidfs(referenceBook.description || '', (i, measure) => {
          if (i === index + 1) { // +1 は基準書籍がインデックス0だから
            score = measure;
          }
        });
      }
      return { book, score };
    });

    // スコアの高い順にソートして上位limit件を返す
    return similarityScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.book);
  }

  /**
   * タイトルと著者を使って類似書籍を見つける（説明文がない場合の代替手段）
   */
  private findSimilarByTitleAndAuthor(
    referenceBook: Book,
    targetBooks: Book[],
    limit: number
  ): Book[] {
    // 簡易的な類似度計算（単語の一致度）
    const similarityScores = targetBooks.map((book) => {
      let score = 0;
      
      // タイトルの単語一致を計算
      const refTitle = referenceBook.book_title.toLowerCase();
      const targetTitle = book.book_title.toLowerCase();
      const refTitleWords = refTitle.split(/\s+/);
      const targetTitleWords = targetTitle.split(/\s+/);
      
      // タイトルの単語が一致するごとにスコア加算
      refTitleWords.forEach((word) => {
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
      .map((item) => item.book);
  }
}
