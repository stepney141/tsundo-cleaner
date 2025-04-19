import { Request, Response } from 'express';
import { BookService } from '../services/bookService';
import { BookType } from '../models/Book';

/**
 * 書籍関連のAPIコントローラー
 */
export class BookController {
  private bookService: BookService;

  constructor() {
    this.bookService = new BookService();
  }

  /**
   * 今週のおすすめ本を取得
   */
  getWeeklyRecommendation = async (req: Request, res: Response): Promise<void> => {
    try {
      const book = await this.bookService.getWeeklyRecommendation();
      res.json(book);
    } catch (error) {
      console.error('週間おすすめ本の取得エラー:', error);
      res.status(500).json({ error: '週間おすすめ本の取得に失敗しました' });
    }
  };

  /**
   * 全ての書籍を取得
   */
  getAllBooks = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = (req.query.type as BookType) || 'wish';
      const books = await this.bookService.getAllBooks(type);
      res.json(books);
    } catch (error) {
      console.error('書籍一覧の取得エラー:', error);
      res.status(500).json({ error: '書籍一覧の取得に失敗しました' });
    }
  };

  /**
   * 書籍検索
   */
  searchBooks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, type = 'wish' } = req.query;
      if (!query) {
        res.status(400).json({ error: '検索クエリが指定されていません' });
        return;
      }

      const books = await this.bookService.searchBooks(type as BookType, query as string);
      res.json(books);
    } catch (error) {
      console.error('書籍検索エラー:', error);
      res.status(500).json({ error: '書籍検索に失敗しました' });
    }
  };

  /**
   * 書籍の詳細情報を取得
   */
  getBookByUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { url, type = 'wish' } = req.query;
      if (!url) {
        res.status(400).json({ error: '書籍URLが指定されていません' });
        return;
      }

      const book = await this.bookService.getBookByUrl(type as BookType, url as string);
      if (!book) {
        res.status(404).json({ error: '指定された書籍が見つかりませんでした' });
        return;
      }

      res.json(book);
    } catch (error) {
      console.error('書籍詳細の取得エラー:', error);
      res.status(500).json({ error: '書籍詳細の取得に失敗しました' });
    }
  };
}
