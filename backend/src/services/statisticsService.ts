import { Book, BookType } from '../models/Book';
import { getDatabase, query, closeDatabase } from '../config/database';

/**
 * 読書統計を計算するサービス
 */
export class StatisticsService {
  /**
   * 出版社別の書籍数を取得
   */
  async getPublisherDistribution(type: BookType = 'wish'): Promise<Array<{ publisher: string; count: number }>> {
    const db = getDatabase();
    try {
      const result = await query<{ publisher: string; count: number }>(
        db,
        `SELECT publisher, COUNT(*) as count 
         FROM ${type} 
         WHERE publisher IS NOT NULL AND publisher != '' 
         GROUP BY publisher 
         ORDER BY count DESC`
      );
      return result;
    } finally {
      await closeDatabase(db);
    }
  }

  /**
   * 著者別の書籍数を取得
   */
  async getAuthorDistribution(type: BookType = 'wish'): Promise<Array<{ author: string; count: number }>> {
    const db = getDatabase();
    try {
      const result = await query<{ author: string; count: number }>(
        db,
        `SELECT author, COUNT(*) as count 
         FROM ${type} 
         WHERE author IS NOT NULL AND author != '' 
         GROUP BY author 
         ORDER BY count DESC 
         LIMIT 20`
      );
      return result;
    } finally {
      await closeDatabase(db);
    }
  }

  /**
   * 出版年別の書籍数を取得（時系列で読書傾向を把握する）
   */
  async getYearDistribution(type: BookType = 'wish'): Promise<Array<{ year: string; count: number }>> {
    const db = getDatabase();
    try {
      // published_date列から年を抽出して集計
      // フォーマットが異なる可能性があるため、複数のパターンに対応
      const result = await query<{ year: string; count: number }>(
        db,
        `SELECT 
           CASE
             WHEN published_date REGEXP '^[0-9]{4}' THEN substr(published_date, 1, 4)
             WHEN published_date REGEXP '[0-9]{4}$' THEN substr(published_date, -4)
             ELSE 'Unknown'
           END as year,
           COUNT(*) as count
         FROM ${type}
         WHERE published_date IS NOT NULL AND published_date != ''
         GROUP BY year
         ORDER BY year DESC`
      );
      return result;
    } finally {
      await closeDatabase(db);
    }
  }

  /**
   * 書籍の所蔵状況（UTokyo/Sophia）の分布を取得
   */
  async getLibraryDistribution(type: BookType = 'wish'): Promise<Array<{ library: string; count: number }>> {
    const db = getDatabase();
    try {
      // UTokyo, Sophia, Bothの3カテゴリに分ける
      const inUTokyo = await query<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM ${type} WHERE exist_in_UTokyo = 'Yes' AND exist_in_Sophia = 'No'`
      );
      
      const inSophia = await query<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM ${type} WHERE exist_in_Sophia = 'Yes' AND exist_in_UTokyo = 'No'`
      );
      
      const inBoth = await query<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM ${type} WHERE exist_in_UTokyo = 'Yes' AND exist_in_Sophia = 'Yes'`
      );
      
      const inNone = await query<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM ${type} WHERE exist_in_UTokyo = 'No' AND exist_in_Sophia = 'No'`
      );
      
      return [
        { library: 'UTokyo', count: inUTokyo[0].count },
        { library: 'Sophia', count: inSophia[0].count },
        { library: 'Both', count: inBoth[0].count },
        { library: 'None', count: inNone[0].count }
      ];
    } finally {
      await closeDatabase(db);
    }
  }
}
