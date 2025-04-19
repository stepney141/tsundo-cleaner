import { Request, Response } from 'express';
import { SimilarityService } from '../services/similarityService';
import { BookType } from '../models/Book';

/**
 * 書籍類似度のAPIコントローラー
 */
export class SimilarityController {
  private similarityService: SimilarityService;

  constructor() {
    this.similarityService = new SimilarityService();
  }

  /**
   * 類似書籍を取得
   */
  getSimilarBooks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { url, type = 'wish', limit = 5 } = req.query;
      
      if (!url) {
        res.status(400).json({ error: '書籍URLが指定されていません' });
        return;
      }

      const similarBooks = await this.similarityService.getSimilarBooks(
        url as string,
        type as BookType,
        Number(limit)
      );
      
      res.json(similarBooks);
    } catch (error) {
      console.error('類似書籍の取得エラー:', error);
      res.status(500).json({ error: '類似書籍の取得に失敗しました' });
    }
  };
}
