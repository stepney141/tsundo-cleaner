import { Request, Response } from 'express';
import * as statisticsService from '../services/statisticsService';
import { BookType } from '../../../shared/types/Book';
import { validateBookType, wrapAsync } from '../utils/errorHandler';

/**
 * 出版社別の書籍数分布を取得
 */
export const getPublisherDistribution = wrapAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'wish';
  validateBookType(type);
  
  const distribution = await statisticsService.getPublisherDistribution(type as BookType);
  res.json(distribution);
});

/**
 * 著者別の書籍数分布を取得
 */
export const getAuthorDistribution = wrapAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'wish';
  validateBookType(type);
  
  const distribution = await statisticsService.getAuthorDistribution(type as BookType);
  res.json(distribution);
});

/**
 * 出版年別の書籍数分布を取得
 */
export const getYearDistribution = wrapAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'wish';
  validateBookType(type);
  
  const distribution = await statisticsService.getYearDistribution(type as BookType);
  res.json(distribution);
});

/**
 * 図書館所蔵状況の分布を取得
 */
export const getLibraryDistribution = wrapAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'wish';
  validateBookType(type);
  
  const distribution = await statisticsService.getLibraryDistribution(type as BookType);
  res.json(distribution);
});
