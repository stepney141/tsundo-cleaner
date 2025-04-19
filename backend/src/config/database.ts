import path from 'path';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import { dirname } from 'path';

// 設定の初期化（.env ファイル、設定ファイル等から読み込み可能）
// デフォルトパスはアプリケーションルートの data ディレクトリに変更
const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'books.sqlite');
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;

// データディレクトリが存在しない場合は作成
const dbDir = dirname(SQLITE_DB_PATH);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`データディレクトリを作成しました: ${dbDir}`);
  } catch (err: any) {
    console.error(`データディレクトリの作成に失敗しました: ${err.message}`);
  }
}

// データベースの存在をチェック
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.warn(`警告: 指定されたデータベースファイル ${SQLITE_DB_PATH} が見つかりません。`);
  console.warn('環境変数 SQLITE_DB_PATH を設定して正しいパスを指定するか、データベースファイルを作成してください。');
}

// シングルトンとして保持するコネクションプール
let dbPool: sqlite3.Database | null = null;

/**
 * SQLiteデータベースコネクションプールを取得する
 * 初回呼び出し時にプールを初期化し、以降は同じインスタンスを返す
 */
export const getDatabase = (): sqlite3.Database => {
  if (dbPool === null) {
    dbPool = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
      if (err) {
        console.error('SQLiteデータベース接続エラー:', err.message);
        throw err;
      }
      console.log('SQLiteデータベースに接続しました:', SQLITE_DB_PATH);
    });
  }
  return dbPool;
};

/**
 * Promise化されたクエリ実行関数
 */
export const query = async <T>(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('クエリ実行エラー:', err.message, '| SQL:', sql, '| パラメータ:', params);
        reject(err);
        return;
      }
      resolve(rows as T[]);
    });
  });
};

/**
 * アプリケーション終了時にデータベース接続を閉じる
 * 通常のサービスでは個別のクエリ後に接続を閉じるのではなく、
 * アプリケーション終了時のみ呼び出す
 */
export const closeDatabase = async (): Promise<void> => {
  if (dbPool !== null) {
    return new Promise((resolve, reject) => {
      const poolRef = dbPool!; // Non-null assertion
      poolRef.close((err) => {
        if (err) {
          console.error('SQLiteデータベース切断エラー:', err.message);
          reject(err);
          return;
        }
        console.log('SQLiteデータベース接続を閉じました');
        dbPool = null;
        resolve();
      });
    });
  }
  return Promise.resolve();
};
