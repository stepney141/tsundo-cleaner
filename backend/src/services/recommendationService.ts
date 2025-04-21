import { db } from '../config/database';
import { Book, BookType } from '../../../shared/types/Book';
import { ValidationError, NotFoundError, validateBookType } from '../utils/errorHandler';
import { convertToAppModel } from './bookService';

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
 * 週間おすすめ本を取得
 * UTokyoにある本を優先順位で取得
 * 「UTokyoにある本」「Sophiaにある本」「どちらにもない本」の優先順位
 */
export const getWeeklyRecommendation = async (): Promise<Book> => {
  try {
    // ランダム性を持たせるために、現在の週番号を使用
    const now = new Date();
    const weekNumber = Math.floor((now.getTime() / (7 * 24 * 60 * 60 * 1000)));
    
    // クエリを実行: UTokyoにある本 → Sophiaにある本 → どちらにもない本の優先順位
    let books = await db.query<BookDB>(
      `SELECT * FROM wish 
       WHERE exist_in_UTokyo = 'Yes'
       ORDER BY book_title`
    );
    
    if (books.length === 0) {
      books = await db.query<BookDB>(
        `SELECT * FROM wish 
         WHERE exist_in_Sophia = 'Yes'
         ORDER BY book_title`
      );
    }
    
    if (books.length === 0) {
      books = await db.query<BookDB>(
        `SELECT * FROM wish 
         ORDER BY book_title`
      );
    }
    
    // 本がない場合はエラー
    if (books.length === 0) {
      throw new NotFoundError('推薦する本が見つかりませんでした');
    }
    
    // 週番号を使ってランダムに1冊選択
    const randomIndex = weekNumber % books.length;
    
    // DB形式からアプリケーション形式に変換
    return convertToAppModel(books[randomIndex]);
  } catch (err) {
    console.error('getWeeklyRecommendationでエラーが発生しました:', err);
    throw err;
  }
};

/**
 * ジャンル（著者/出版社）に基づく推薦
 * 特定の著者や出版社の本をランダムに推薦
 */
export const getRecommendationByGenre = async (
  type: BookType = 'wish',
  genreType: 'author' | 'publisher',
  genreValue: string
): Promise<Book> => {
  // 書籍タイプのバリデーション
  validateBookType(type);

  // genreTypeも検証
  if (genreType !== 'author' && genreType !== 'publisher') {
    throw new ValidationError(`無効なジャンルタイプ: ${genreType}`);
  }
  
  if (!genreValue) {
    throw new ValidationError('ジャンル値は必須です');
  }
  
  try {
    // クエリを実行
    const books = await db.query<BookDB>(
      `SELECT * FROM ${type} 
       WHERE ${genreType} = ?
       ORDER BY RANDOM()
       LIMIT 1`,
      [genreValue]
    );
    
    if (books.length === 0) {
      throw new NotFoundError(`${genreType}が "${genreValue}" の本が見つかりませんでした`);
    }
    
    // DB形式からアプリケーション形式に変換
    return convertToAppModel(books[0]);
  } catch (err) {
    console.error(`getRecommendationByGenre(${type}, ${genreType}, ${genreValue})でエラーが発生しました:`, err);
    throw err;
  }
};
