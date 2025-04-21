import { Request, Response } from 'express';
import * as similarityService from '../services/similarityService';
import { BookType } from '../../../shared/types/Book';
import { validateBookType, validateRequiredParam, wrapAsync } from '../utils/errorHandler';
import { getPaginationFromRequest } from './bookController';

/**
 * 類似書籍を取得
 */
export const getSimilarBooks = wrapAsync(async (req: Request, res: Response) => {
  const { url, type = 'wish', limit = '5' } = req.query;
  
  validateBookType(type as string);
  validateRequiredParam(url, '書籍URL');
  
  const limitNum = parseInt(limit as string, 10);
  
  const similarBooks = await similarityService.getSimilarBooks(
    url as string,
    type as BookType,
    limitNum
  );
  
  res.json(similarBooks);
});
