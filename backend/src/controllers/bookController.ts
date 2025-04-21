import { Request, Response } from 'express';
import * as bookService from '../services/bookService';
import * as recommendationService from '../services/recommendationService';
import { BookType, PaginationParams } from '../../../shared/types/Book';
import { validateBookType, validateRequiredParam, wrapAsync } from '../utils/errorHandler';

/**
 * リクエストからページネーションパラメータを抽出する純粋関数
 */
export const getPaginationFromRequest = (req: Request): PaginationParams => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
  return { page, limit };
};

/**
 * 今週のおすすめ本を取得
 */
export const getWeeklyRecommendation = wrapAsync(async (req: Request, res: Response) => {
  const book = await recommendationService.getWeeklyRecommendation();
  res.json(book);
});

/**
 * ジャンル別のおすすめ本を取得
 */
export const getRecommendationByGenre = wrapAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'wish';
  const { genreType, genreValue } = req.query;
  
  validateBookType(type);
  validateRequiredParam(genreType, 'genreType');
  validateRequiredParam(genreValue, 'genreValue');
  
  if (genreType !== 'author' && genreType !== 'publisher') {
    throw new Error('ジャンルタイプは author または publisher である必要があります');
  }
  
  const book = await recommendationService.getRecommendationByGenre(
    type as BookType,
    genreType as 'author' | 'publisher',
    genreValue as string
  );
  
  res.json(book);
});

/**
 * 全ての書籍を取得（ページネーション対応）
 */
export const getAllBooks = wrapAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'wish';
  validateBookType(type);
  
  const pagination = getPaginationFromRequest(req);
  const books = await bookService.getAllBooks(type as BookType, pagination);
  
  res.json(books);
});

/**
 * 書籍検索（ページネーション対応）
 */
export const searchBooks = wrapAsync(async (req: Request, res: Response) => {
  console.log('検索リクエスト受信:', req.query);
  
  const { query, type = 'wish' } = req.query;
  console.log('抽出したパラメータ:', { query, type });
  
  validateBookType(type as string);
  validateRequiredParam(query, '検索クエリ');
  
  const pagination = getPaginationFromRequest(req);
  console.log('ページネーション設定:', pagination);
  
  try {
    const books = await bookService.searchBooks(
      type as BookType, 
      query as string,
      pagination
    );
    
    console.log(`検索結果: ${books.items.length}件`);
    
    res.json(books.items);
  } catch (error) {
    console.error('検索処理エラー:', error);
    throw error;
  }
});

/**
 * 書籍の詳細情報を取得
 */
export const getBookByUrl = wrapAsync(async (req: Request, res: Response) => {
  const { url, type = 'wish' } = req.query;
  validateBookType(type as string);
  validateRequiredParam(url, '書籍URL');
  
  const book = await bookService.getBookByUrl(type as BookType, url as string);
  res.json(book);
});
