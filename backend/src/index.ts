import dotenv from 'dotenv';
// .envファイルを読み込む（これは他のインポートより前に行う必要があります）
dotenv.config();

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import { serverConfig, getServerUrl } from './config/server';
import { errorHandler, notFoundHandler } from './utils/errorHandler';
import { closeAllDatabases } from './config/database';
import { initEmbeddingCache } from './services/embeddingCache';

// サーバー設定の取得
const PORT = serverConfig.port;

// Expressアプリケーションの初期化
const app: Express = express();

// ミドルウェアの設定
// 本番環境では適切なCORS設定を行う
if (process.env.NODE_ENV === 'production') {
  // 本番環境では、許可されたオリジンのみを受け入れる
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    [`http://${serverConfig.host}:${serverConfig.port}`];
  
  app.use(cors({
    origin: (origin, callback) => {
      // オリジンがnull/undefined（例：Postmanからのリクエスト）の場合や、
      // 許可されたオリジンからのリクエストの場合は許可
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200
  }));
} else {
  // 開発環境では全てのオリジンを許可
  app.use(cors());
}

app.use(express.json()); // JSONボディパーサー

// リクエストロギングミドルウェア
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  
  // レスポンス完了時のログ
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

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

// エラーハンドリングミドルウェアの設定
// APIルートが存在するがリソースが見つからない場合のハンドリング
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // APIルートは存在するが、具体的なリソースが見つからない場合の処理
  // ルートハンドラでエラーがスローされると、次のミドルウェア（グローバルエラーハンドラ）に処理が移る
  console.log(`[404] API not found: ${req.method} ${req.originalUrl}`);
  notFoundHandler(req, res);
});

// 存在しないルートの対応
app.use('*', (req: Request, res: Response) => {
  console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  notFoundHandler(req, res);
});

// グローバルエラーハンドラ - すべてのルートハンドラでスローされたエラーを捕捉
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  errorHandler(err, req, res, next);
});

// サーバー起動
const server = app.listen(PORT, async () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
  console.log(`${getServerUrl()}/`);
  
  // 埋め込みベクトルキャッシュの初期化
  try {
    await initEmbeddingCache();
    console.log('埋め込みベクトルキャッシュを初期化しました');
  } catch (error) {
    console.error('埋め込みベクトルキャッシュの初期化に失敗しました:', error);
  }
});

// プロセス終了時の処理
const gracefulShutdown = async () => {
  console.log('アプリケーションを終了しています...');
  
  // サーバーのシャットダウン
  server.close(async () => {
    console.log('HTTPサーバーを停止しました');
    
    // すべてのデータベース接続を閉じる
    try {
      await closeAllDatabases();
      console.log('全ての接続を正常に閉じました');
      process.exit(0);
    } catch (err) {
      console.error('接続のクローズ中にエラーが発生しました:', err);
      process.exit(1);
    }
  });
};

// シグナルハンドラの設定
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
