import { Request, Response } from 'express';
import { StatisticsService } from '../services/statisticsService';
import { BookType } from '../models/Book';

/**
 * 統計情報のAPIコントローラー
 */
export class StatisticsController {
  private statisticsService: StatisticsService;

  constructor() {
    this.statisticsService = new StatisticsService();
  }

  /**
   * 出版社別の書籍数分布を取得
   */
  getPublisherDistribution = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = (req.query.type as BookType) || 'wish';
      const distribution = await this.statisticsService.getPublisherDistribution(type);
      res.json(distribution);
    } catch (error) {
      console.error('出版社別分布の取得エラー:', error);
      res.status(500).json({ error: '出版社別分布の取得に失敗しました' });
    }
  };

  /**
   * 著者別の書籍数分布を取得
   */
  getAuthorDistribution = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = (req.query.type as BookType) || 'wish';
      const distribution = await this.statisticsService.getAuthorDistribution(type);
      res.json(distribution);
    } catch (error) {
      console.error('著者別分布の取得エラー:', error);
      res.status(500).json({ error: '著者別分布の取得に失敗しました' });
    }
  };

  /**
   * 出版年別の書籍数分布を取得
   */
  getYearDistribution = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = (req.query.type as BookType) || 'wish';
      const distribution = await this.statisticsService.getYearDistribution(type);
      res.json(distribution);
    } catch (error) {
      console.error('出版年別分布の取得エラー:', error);
      res.status(500).json({ error: '出版年別分布の取得に失敗しました' });
    }
  };

  /**
   * 図書館所蔵状況の分布を取得
   */
  getLibraryDistribution = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = (req.query.type as BookType) || 'wish';
      const distribution = await this.statisticsService.getLibraryDistribution(type);
      res.json(distribution);
    } catch (error) {
      console.error('図書館所蔵状況の取得エラー:', error);
      res.status(500).json({ error: '図書館所蔵状況の取得に失敗しました' });
    }
  };
}
