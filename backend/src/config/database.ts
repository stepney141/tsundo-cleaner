import path from 'path';
import sqlite3 from 'sqlite3';

import * as fs from 'fs';

// 環境変数から取得するか、デフォルト値を使用
const DEFAULT_DB_PATH = '/home/stepney141/favs/bookmeter_wish/books.sqlite';
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;

// データベースの存在をチェック
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.warn(`警告: 指定されたデータベースファイル ${SQLITE_DB_PATH} が見つかりません。`);
  console.warn('環境変数 SQLITE_DB_PATH を設定して正しいパスを指定するか、データベースファイルを作成してください。');
}

/**
 * SQLiteデータベース接続を取得する
 */
export const getDatabase = (): sqlite3.Database => {
  const db = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
    if (err) {
      console.error('SQLiteデータベース接続エラー:', err.message);
      throw err;
    }
    console.log('SQLiteデータベースに接続しました:', SQLITE_DB_PATH);
  });

  return db;
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
        console.error('クエリ実行エラー:', err.message);
        reject(err);
        return;
      }
      resolve(rows as T[]);
    });
  });
};

/**
 * データベース接続を閉じる
 */
export const closeDatabase = (db: sqlite3.Database): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('SQLiteデータベース切断エラー:', err.message);
        reject(err);
        return;
      }
      console.log('SQLiteデータベース接続を閉じました');
      resolve();
    });
  });
};
