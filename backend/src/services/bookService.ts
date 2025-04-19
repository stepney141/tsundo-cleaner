import { Book, BookType } from '../models/Book';
import { getDatabase, query, closeDatabase } from '../config/database';

/**
 * 書籍データを取得するサービス
 */
export class BookService {
  /**
   * 書籍タイプ（wish/stacked）に基づいて全ての書籍を取得
   */
  async getAllBooks(type: BookType): Promise<Book[]> {
    const db = getDatabase();
    try {
      const books = await query<Book>(db, `SELECT * FROM ${type}`);
      return books;
    } finally {
      await closeDatabase(db);
    }
  }

  /**
   * 特定の書籍URLに基づいて書籍を取得
   */
  async getBookByUrl(type: BookType, url: string): Promise<Book | null> {
    const db = getDatabase();
    try {
      const books = await query<Book>(
        db,
        `SELECT * FROM ${type} WHERE bookmeter_url = ?`,
        [url]
      );
      return books.length > 0 ? books[0] : null;
    } finally {
      await closeDatabase(db);
    }
  }

  /**
   * 検索クエリに基づいて書籍を検索
   */
  async searchBooks(type: BookType, searchQuery: string): Promise<Book[]> {
    const db = getDatabase();
    try {
      const searchTerm = `%${searchQuery}%`;
      const books = await query<Book>(
        db,
        `SELECT * FROM ${type} 
         WHERE book_title LIKE ? 
         OR author LIKE ? 
         OR publisher LIKE ?
         OR description LIKE ?`,
        [searchTerm, searchTerm, searchTerm, searchTerm]
      );
      return books;
    } finally {
      await closeDatabase(db);
    }
  }

  /**
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
      let books = await query<Book>(
        db,
        `SELECT * FROM wish 
         WHERE exist_in_UTokyo = 'Yes'
         ORDER BY book_title`
      );
      
      if (books.length === 0) {
        books = await query<Book>(
          db,
          `SELECT * FROM wish 
           WHERE exist_in_Sophia = 'Yes'
           ORDER BY book_title`
        );
      }
      
      if (books.length === 0) {
        books = await query<Book>(
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
      return books[randomIndex];
    } finally {
      await closeDatabase(db);
    }
  }
}
