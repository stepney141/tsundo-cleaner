import { db } from '../config/database';
import { BookType, PublisherDistribution, AuthorDistribution, YearDistribution, LibraryDistribution } from '../../../shared/types/Book';
import { validateBookType } from '../utils/errorHandler';

/**
 * 出版社別の書籍数を取得
 */
export const getPublisherDistribution = async (
  type: BookType = 'wish'
): Promise<PublisherDistribution[]> => {
  // 書籍タイプのバリデーション
  validateBookType(type);
  
  try {
    const result = await db.query<PublisherDistribution>(
      `SELECT publisher, COUNT(*) as count 
       FROM ${type} 
       WHERE publisher IS NOT NULL AND publisher != '' 
       GROUP BY publisher 
       ORDER BY count DESC`
    );
    return result;
  } catch (err) {
    console.error(`getPublisherDistribution(${type})でエラーが発生しました:`, err);
    throw err;
  }
};

/**
 * 著者別の書籍数を取得
 */
export const getAuthorDistribution = async (
  type: BookType = 'wish'
): Promise<AuthorDistribution[]> => {
  // 書籍タイプのバリデーション
  validateBookType(type);
  
  try {
    const result = await db.query<AuthorDistribution>(
      `SELECT author, COUNT(*) as count 
       FROM ${type} 
       WHERE author IS NOT NULL AND author != '' 
       GROUP BY author 
       ORDER BY count DESC 
       LIMIT 20`
    );
    return result;
  } catch (err) {
    console.error(`getAuthorDistribution(${type})でエラーが発生しました:`, err);
    throw err;
  }
};

/**
 * 出版年別の書籍数を取得（時系列で読書傾向を把握する）
 */
export const getYearDistribution = async (
  type: BookType = 'wish'
): Promise<YearDistribution[]> => {
  // 書籍タイプのバリデーション
  validateBookType(type);
  
  try {
    // published_date列から年を抽出して集計
    // フォーマットが異なる可能性があるため、複数のパターンに対応
    const result = await db.query<YearDistribution>(
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
  } catch (err) {
    console.error(`getYearDistribution(${type})でエラーが発生しました:`, err);
    throw err;
  }
};

/**
 * 書籍の所蔵状況（UTokyo/Sophia）の分布を取得
 */
export const getLibraryDistribution = async (
  type: BookType = 'wish'
): Promise<LibraryDistribution[]> => {
  // 書籍タイプのバリデーション
  validateBookType(type);
  
  try {
    // 一度のクエリで全ての情報を取得するように最適化
    const distribution = await db.query<{ library: string; count: number }>(
      `SELECT 
        CASE 
          WHEN exist_in_UTokyo = 'Yes' AND exist_in_Sophia = 'No' THEN 'UTokyo'
          WHEN exist_in_Sophia = 'Yes' AND exist_in_UTokyo = 'No' THEN 'Sophia'
          WHEN exist_in_UTokyo = 'Yes' AND exist_in_Sophia = 'Yes' THEN 'Both'
          ELSE 'None'
        END as library,
        COUNT(*) as count
      FROM ${type}
      GROUP BY library
      ORDER BY count DESC`
    );
    
    // 全カテゴリを結果に含める（0件のものも含む）
    const categories = ['UTokyo', 'Sophia', 'Both', 'None'];
    const result: LibraryDistribution[] = categories.map(category => {
      const found = distribution.find(item => item.library === category);
      return {
        library: category,
        count: found ? found.count : 0
      };
    });
    
    return result;
  } catch (err) {
    console.error(`getLibraryDistribution(${type})でエラーが発生しました:`, err);
    throw err;
  }
};
