import express, { Router } from 'express';
import * as bookController from '../controllers/bookController';
import * as similarityController from '../controllers/similarityController';
import * as statisticsController from '../controllers/statisticsController';
import { errorHandler, notFoundHandler } from '../utils/errorHandler';

const router: Router = express.Router();

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
