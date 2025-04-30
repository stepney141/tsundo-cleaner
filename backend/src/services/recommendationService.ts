import { getDatabase, DatabaseType } from '../config/database';
import { Book, BookType } from '../../../shared/types/Book';
import { ValidationError, NotFoundError, validateBookType } from '../utils/errorHandler';
import { convertToAppModel } from './bookService';

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
 * 週間おすすめ本を取得
 * UTokyoにある本を優先順位で取得
 * 「UTokyoにある本」「Sophiaにある本」「どちらにもない本」の優先順位
 */
export const getWeeklyRecommendation = async (): Promise<Book> => {
  console.log('[週間おすすめ] リクエスト受信');
  try {
    // ランダム性を持たせるために、現在の週番号を使用
    const now = new Date();
    const weekNumber = Math.floor((now.getTime() / (7 * 24 * 60 * 60 * 1000)));
    console.log(`[週間おすすめ] 週番号計算: ${weekNumber}`);
    
    console.log('[週間おすすめ] UTokyo本のクエリ実行開始');
    // クエリを実行: UTokyoにある本 → Sophiaにある本 → どちらにもない本の優先順位
    let books: BookDB[] = [];
    try {
      books = await bookDb.query<BookDB>(
        `SELECT * FROM wish 
         WHERE exist_in_UTokyo = 'Yes'
         ORDER BY book_title`
      );
      console.log(`[週間おすすめ] UTokyo本のクエリ結果: ${books.length}件`);
    } catch (queryErr) {
      console.error('[週間おすすめ] UTokyo本のクエリ実行エラー:', queryErr);
      // エラーを再スローせず、次のクエリを試みる
    }
    
    if (books.length === 0) {
      console.log('[週間おすすめ] UTokyo本が見つからないため、Sophia本のクエリを実行');
      try {
        books = await bookDb.query<BookDB>(
          `SELECT * FROM wish 
           WHERE exist_in_Sophia = 'Yes'
           ORDER BY book_title`
        );
        console.log(`[週間おすすめ] Sophia本のクエリ結果: ${books.length}件`);
      } catch (queryErr) {
        console.error('[週間おすすめ] Sophia本のクエリ実行エラー:', queryErr);
        // エラーを再スローせず、次のクエリを試みる
      }
    }
    
    if (books.length === 0) {
      console.log('[週間おすすめ] Sophia本も見つからないため、全ての本のクエリを実行');
      try {
        books = await bookDb.query<BookDB>(
          `SELECT * FROM wish 
           ORDER BY book_title`
        );
        console.log(`[週間おすすめ] 全ての本のクエリ結果: ${books.length}件`);
      } catch (queryErr) {
        console.error('[週間おすすめ] 全ての本のクエリ実行エラー:', queryErr);
        throw queryErr; // 最後のクエリでもエラーの場合は再スロー
      }
    }
    
    // 本がない場合はエラー
    if (books.length === 0) {
      console.log('[週間おすすめ] 本が見つかりませんでした');
      throw new NotFoundError('推薦する本が見つかりませんでした');
    }
    
    // 週番号を使ってランダムに1冊選択
    const randomIndex = weekNumber % books.length;
    console.log(`[週間おすすめ] 選択されたインデックス: ${randomIndex}/${books.length}`);
    
    const selectedBook = books[randomIndex];
    console.log(`[週間おすすめ] 選択された本: ${selectedBook.book_title}`);
    
    // DB形式からアプリケーション形式に変換
    const result = convertToAppModel(selectedBook);
    // 書籍タイプを追加（週間おすすめは現在wishテーブルから取得しているため'wish'）
    const resultWithType = {
      ...result,
      bookType: 'wish' as BookType
    };
    console.log('[週間おすすめ] 正常にレスポンスを返します');
    return resultWithType;
  } catch (err) {
    console.error('[週間おすすめ] エラーが発生しました:', err);
    if (err instanceof Error) {
      console.error('[週間おすすめ] エラーの詳細:', { 
        name: err.name, 
        message: err.message, 
        stack: err.stack 
      });
    }
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
    const books = await bookDb.query<BookDB>(
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
