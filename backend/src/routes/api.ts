import express, { Router } from 'express';
import { BookController } from '../controllers/bookController';
import { SimilarityController } from '../controllers/similarityController';
import { StatisticsController } from '../controllers/statisticsController';

const router: Router = express.Router();

// コントローラーのインスタンス化
const bookController = new BookController();
const similarityController = new SimilarityController();
const statisticsController = new StatisticsController();

// 書籍関連のルート
router.get('/books', bookController.getAllBooks);
router.get('/books/search', bookController.searchBooks);
router.get('/book', bookController.getBookByUrl);

// 推薦関連のルート
router.get('/books/weekly', bookController.getWeeklyRecommendation);
router.get('/books/recommend-by-genre', bookController.getRecommendationByGenre);

// 類似書籍関連のルート
router.get('/books/similar', similarityController.getSimilarBooks);

// 統計情報関連のルート
router.get('/stats/publishers', statisticsController.getPublisherDistribution);
router.get('/stats/authors', statisticsController.getAuthorDistribution);
router.get('/stats/years', statisticsController.getYearDistribution);
router.get('/stats/libraries', statisticsController.getLibraryDistribution);

export default router;
