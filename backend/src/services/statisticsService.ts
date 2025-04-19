import { BookType } from '../models/Book';
import { getDatabase, query } from '../config/database';

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
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      const result = await query<{ publisher: string; count: number }>(
        db,
        `SELECT publisher, COUNT(*) as count 
         FROM ${type} 
         WHERE publisher IS NOT NULL AND publisher != '' 
         GROUP BY publisher 
         ORDER BY count DESC`
      );
      return result;
    } catch (err: any) {
      console.error(`getPublisherDistribution(${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  /**
   * 著者別の書籍数を取得
   */
  async getAuthorDistribution(type: BookType = 'wish'): Promise<Array<{ author: string; count: number }>> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
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
    } catch (err: any) {
      console.error(`getAuthorDistribution(${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  /**
   * 出版年別の書籍数を取得（時系列で読書傾向を把握する）
   */
  async getYearDistribution(type: BookType = 'wish'): Promise<Array<{ year: string; count: number }>> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      // published_date列から年を抽出して集計
      // フォーマットが異なる可能性があるため、複数のパターンに対応
      const result = await query<{ year: string; count: number }>(
        db,
        `SELECT 
           CASE
             WHEN substr(published_date, 1, 4) GLOB '[0-9][0-9][0-9][0-9]' THEN substr(published_date, 1, 4)
             WHEN length(published_date) >= 4 AND substr(published_date, -4) GLOB '[0-9][0-9][0-9][0-9]' THEN substr(published_date, -4)
             ELSE 'Unknown'
           END as year,
           COUNT(*) as count
         FROM ${type}
         WHERE published_date IS NOT NULL AND published_date != ''
         GROUP BY year
         ORDER BY year DESC`
      );
      return result;
    } catch (err: any) {
      console.error(`getYearDistribution(${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  /**
   * 書籍の所蔵状況（UTokyo/Sophia）の分布を取得
   */
  async getLibraryDistribution(type: BookType = 'wish'): Promise<Array<{ library: string; count: number }>> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      // 一度のクエリで全ての情報を取得するように最適化
      const distribution = await query<{ category: string; count: number }>(
        db,
        `SELECT 
          CASE 
            WHEN exist_in_UTokyo = 'Yes' AND exist_in_Sophia = 'No' THEN 'UTokyo'
            WHEN exist_in_Sophia = 'Yes' AND exist_in_UTokyo = 'No' THEN 'Sophia'
            WHEN exist_in_UTokyo = 'Yes' AND exist_in_Sophia = 'Yes' THEN 'Both'
            ELSE 'None'
          END as category,
          COUNT(*) as count
        FROM ${type}
        GROUP BY category
        ORDER BY count DESC`
      );
      
      // 結果を標準フォーマットに変換
      const result: Array<{ library: string; count: number }> = [];
      const categories = ['UTokyo', 'Sophia', 'Both', 'None'];
      
      // 全カテゴリを結果に含める（0件のものも含む）
      categories.forEach(category => {
        const found = distribution.find(item => item.category === category);
        result.push({
          library: category,
          count: found ? found.count : 0
        });
      });
      
      return result;
    } catch (err: any) {
      console.error(`getLibraryDistribution(${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }
}
