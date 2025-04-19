import { Book, BookDB, BookType } from '../models/Book';
import { getDatabase, query } from '../config/database';

/**
 * 書籍推薦機能を提供するサービス
 */
export class RecommendationService {
  /**
   * DB形式の書籍データをアプリケーション形式に変換する
   */
  private convertToAppModel(dbBook: BookDB): Book {
    return {
      ...dbBook,
      exist_in_Sophia: dbBook.exist_in_Sophia === 'Yes',
      exist_in_UTokyo: dbBook.exist_in_UTokyo === 'Yes'
    };
  }

  /**
   * 週間おすすめ本を取得
   * UTokyoにある本を優先順位で取得
   * 「UTokyoにある本」「Sophiaにある本」「どちらにもない本」の優先順位
   */
  async getWeeklyRecommendation(): Promise<Book> {
    const db = getDatabase();
    try {
      // ランダム性を持たせるために、現在の週番号を使用
      const now = new Date();
      const weekNumber = Math.floor((now.getTime() / (7 * 24 * 60 * 60 * 1000)));
      
      // クエリを実行: UTokyoにある本 → Sophiaにある本 → どちらにもない本の優先順位
      let books = await query<BookDB>(
        db,
        `SELECT * FROM wish 
         WHERE exist_in_UTokyo = 'Yes'
         ORDER BY book_title`
      );
      
      if (books.length === 0) {
        books = await query<BookDB>(
          db,
          `SELECT * FROM wish 
           WHERE exist_in_Sophia = 'Yes'
           ORDER BY book_title`
        );
      }
      
      if (books.length === 0) {
        books = await query<BookDB>(
          db,
          `SELECT * FROM wish 
           ORDER BY book_title`
        );
      }
      
      // 本がない場合はエラー
      if (books.length === 0) {
        throw new Error('推薦する本が見つかりませんでした');
      }
      
      // 週番号を使ってランダムに1冊選択
      const randomIndex = weekNumber % books.length;
      
      // DB形式からアプリケーション形式に変換
      return this.convertToAppModel(books[randomIndex]);
    } catch (err: any) {
      console.error('getWeeklyRecommendationでエラーが発生しました:', err.message);
      throw err;
    }
  }

  /**
   * ジャンル（著者/出版社）に基づく推薦
   * 特定の著者や出版社の本をランダムに推薦
   */
  async getRecommendationByGenre(
    type: BookType = 'wish',
    genreType: 'author' | 'publisher',
    genreValue: string
  ): Promise<Book | null> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }

      // genreTypeも検証
      if (genreType !== 'author' && genreType !== 'publisher') {
        throw new Error(`無効なジャンルタイプ: ${genreType}`);
      }
      
      // クエリを実行
      const books = await query<BookDB>(
        db,
        `SELECT * FROM ${type} 
         WHERE ${genreType} = ?
         ORDER BY RANDOM()
         LIMIT 1`,
        [genreValue]
      );
      
      if (books.length === 0) {
        return null;
      }
      
      // DB形式からアプリケーション形式に変換
      return this.convertToAppModel(books[0]);
    } catch (err: any) {
      console.error(`getRecommendationByGenre(${type}, ${genreType}, ${genreValue})でエラーが発生しました:`, err.message);
      throw err;
    }
  }
}
