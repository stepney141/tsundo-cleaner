import { db } from '../config/database';
import { Book, BookType, PaginatedResult, PaginationParams } from '../../../shared/types/Book';
import { NotFoundError, ValidationError, validateBookType } from '../utils/errorHandler';

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
    const result = await db.queryWithPagination<BookDB>(type, page, limit);
    
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
    const books = await db.query<BookDB>(
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
 * 検索クエリに基づいて書籍を検索する関数（ページネーション対応）
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
    const searchTerm = `%${searchQuery}%`;
    const conditions = 'book_title LIKE ? OR author LIKE ? OR publisher LIKE ? OR description LIKE ?';
    const params = [searchTerm, searchTerm, searchTerm, searchTerm];
    
    console.log('SQLクエリ条件:', conditions);
    console.log('SQLクエリパラメータ:', params);
    
    // ページネーション付きクエリの実行
    const result = await db.queryWithPagination<BookDB>(
      type, 
      page, 
      limit, 
      conditions, 
      params
    );
    
    console.log(`データベース検索結果: ${result.items.length}件 / 全${result.totalItems}件`);
    
    // アプリケーションモデルに変換
    const items = result.items.map(convertToAppModel);
    
    const paginatedResult = {
      items,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      currentPage: page,
      hasNextPage: page < result.totalPages,
      hasPrevPage: page > 1
    };
    
    console.log('返却するページネーション結果:', {
      totalItems: paginatedResult.totalItems,
      totalPages: paginatedResult.totalPages,
      itemsCount: paginatedResult.items.length
    });
    
    return paginatedResult;
  } catch (err) {
    console.error(`searchBooks(${type}, "${searchQuery}")でエラーが発生しました:`, err);
    throw err;
  }
};
