import express, { Express } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';

// 環境変数の設定
const PORT = process.env.PORT || 3001;

// Expressアプリケーションの初期化
const app: Express = express();

// ミドルウェアの設定
app.use(cors()); // CORS設定
app.use(express.json()); // JSONボディパーサー

// ルートの設定
app.use('/api', apiRoutes);

// 基本ルート
app.get('/', (req, res) => {
  res.json({
    message: 'tsundo-cleaner API サーバー',
    endpoints: {
      weekly: '/api/books/weekly',
      books: '/api/books',
      search: '/api/books/search?query=検索語',
      book: '/api/book?url=書籍URL',
      similar: '/api/books/similar?url=書籍URL',
      stats: {
        publishers: '/api/stats/publishers',
        authors: '/api/stats/authors',
        years: '/api/stats/years',
        libraries: '/api/stats/libraries'
      }
    }
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
  console.log(`http://localhost:${PORT}/`);
});
