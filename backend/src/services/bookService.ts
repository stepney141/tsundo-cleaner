import { Book, BookDB, BookType } from '../models/Book';
import { getDatabase, query } from '../config/database';

/**
 * 書籍データを取得するサービス
 */
export class BookService {
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
   * 書籍タイプ（wish/stacked）に基づいて全ての書籍を取得
   */
  async getAllBooks(type: BookType): Promise<Book[]> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      const books = await query<BookDB>(db, `SELECT * FROM ${type}`);
      
      // DB形式からアプリケーション形式に変換
      return books.map(book => this.convertToAppModel(book));
    } catch (err: any) {
      console.error(`getAllBooks(${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  /**
   * 特定の書籍URLに基づいて書籍を取得
   */
  async getBookByUrl(type: BookType, url: string): Promise<Book | null> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      const books = await query<BookDB>(
        db,
        `SELECT * FROM ${type} WHERE bookmeter_url = ?`,
        [url]
      );
      
      if (books.length === 0) {
        return null;
      }
      
      // DB形式からアプリケーション形式に変換
      return this.convertToAppModel(books[0]);
    } catch (err: any) {
      console.error(`getBookByUrl(${type}, ${url})でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  /**
   * 検索クエリに基づいて書籍を検索
   */
  async searchBooks(type: BookType, searchQuery: string): Promise<Book[]> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      const searchTerm = `%${searchQuery}%`;
      const books = await query<BookDB>(
        db,
        `SELECT * FROM ${type} 
         WHERE book_title LIKE ? 
         OR author LIKE ? 
         OR publisher LIKE ?
         OR description LIKE ?`,
        [searchTerm, searchTerm, searchTerm, searchTerm]
      );
      
      // DB形式からアプリケーション形式に変換
      return books.map(book => this.convertToAppModel(book));
    } catch (err: any) {
      console.error(`searchBooks(${type}, "${searchQuery}")でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  // 推薦機能はRecommendationServiceに移動しました
}
