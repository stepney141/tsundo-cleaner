import path from 'path';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import { dirname } from 'path';
import { DatabaseError } from '../utils/errorHandler';
import { FirebaseService, createFirebaseService } from '../services/firebaseService';

/**
 * データベース設定インターフェース
 */
export interface DatabaseConfig {
  path: string;
  autoSync?: boolean;          // Firebase自動同期の有効/無効
  syncInterval?: number;       // 自動同期の間隔（ミリ秒）
}

/**
 * データベース接続を管理するクラス
 * 関数型アプローチに基づいた設計
 */
export class Database {
  private readonly config: DatabaseConfig;
  private db: sqlite3.Database | null = null;
  private firebaseService: FirebaseService | null = null;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false; // 同期中フラグを追加
  private queryQueue: { resolve: (value: any) => void, reject: (reason?: any) => void, sql: string, params: any[] }[] = []; // クエリ待機キュー

  /**
   * コンストラクタ - 設定を受け取る
   */
  constructor(config: DatabaseConfig) {
    this.config = {
      autoSync: process.env.DB_AUTO_SYNC === 'true',
      syncInterval: parseInt(process.env.DB_SYNC_INTERVAL || '86400000', 10), // デフォルト24時間
      ...config
    };

    // Firebaseサービスの初期化（条件付き）
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_STORAGE_BUCKET) {
      try {
        this.firebaseService = createFirebaseService();
        console.log('Firebaseサービスが初期化されました');
      } catch (err: any) {
        console.error('Firebaseサービスの初期化に失敗しました:', err.message);
        this.firebaseService = null;
      }
    }

    this.ensureDatabaseDirectory();
    
    // 初期同期の実行
    this.syncDatabaseFromFirebase().catch(err => {
      console.error('初期データベース同期エラー:', err.message);
    });
    
    // 自動同期の設定
    if (this.config.autoSync && this.config.syncInterval && this.firebaseService) {
      this.setupAutoSync();
    }
  }

  /**
   * データベースディレクトリの存在を確認し、必要に応じて作成
   */
  private ensureDatabaseDirectory(): void {
    const dbDir = dirname(this.config.path);
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`データディレクトリを作成しました: ${dbDir}`);
      } catch (err: any) {
        console.error(`データディレクトリの作成に失敗しました: ${err.message}`);
      }
    }

    // データベースの存在をチェック
    if (!fs.existsSync(this.config.path)) {
      console.warn(`警告: 指定されたデータベースファイル ${this.config.path} が見つかりません。`);
      
      if (this.firebaseService) {
        console.log('Firebaseからデータベースファイルを取得しようとしています...');
      } else {
        console.warn('環境変数 SQLITE_DB_PATH を設定して正しいパスを指定するか、データベースファイルを作成してください。');
      }
    }
  }
  
  /**
   * Firebase Storageからデータベースを同期
   */
  public async syncDatabaseFromFirebase(): Promise<boolean> {
    if (!this.firebaseService) {
      return false;
    }

    if (this.isSyncing) {
      console.log('現在同期処理中のため、今回の同期はスキップします。');
      return false;
    }

    this.isSyncing = true;
    console.log('データベース同期処理を開始します...');
    const tempDbPath = this.config.path + '.tmp'; // 一時ファイルパス

    try {
      const needsUpdate = await this.firebaseService.shouldUpdateDatabase(this.config.path);

      if (needsUpdate) {
        console.log('データベースの更新が必要です。Firebaseから一時ファイルへダウンロードを開始します...');

        // 一時ファイルへダウンロード
        await this.firebaseService.downloadDatabase(tempDbPath);
        console.log(`一時ファイルへのダウンロードが完了しました: ${tempDbPath}`);

        // 既存の接続を閉じる
        await this.close(); // 接続を閉じてからファイルを置き換える

        // ファイルをアトミックに置き換え
        try {
          fs.renameSync(tempDbPath, this.config.path);
          console.log(`データベースファイルを更新しました: ${this.config.path}`);
        } catch (renameErr: any) {
          console.error(`データベースファイルのリネームに失敗しました: ${renameErr.message}`);
          // リネーム失敗時は一時ファイルを削除
          if (fs.existsSync(tempDbPath)) {
            fs.unlinkSync(tempDbPath);
          }
          throw renameErr; // エラーを再スローして同期失敗とする
        }

        console.log('データベース同期が正常に完了しました。');
        return true; // 更新があったことを示す
      } else {
        console.log('データベースは最新の状態です。同期は不要です。');
        return false; // 更新がなかったことを示す
      }
    } catch (err: any) {
      console.error('データベース同期エラー:', err.message);
      // エラー時はローカルファイルを使用する
      console.log('ローカルのデータベースファイルを引き続き使用します');
      return false; // 同期失敗
    } finally {
      this.isSyncing = false; // 同期フラグを解除
      console.log('データベース同期処理を終了します。');
      // 待機中のクエリを実行
      this.processQueryQueue();
    }
  }

  /**
   * 待機中のクエリを実行するヘルパー関数
   */
  private processQueryQueue(): void {
    console.log(`待機中のクエリを処理します。キューの長さ: ${this.queryQueue.length}`);
    while (this.queryQueue.length > 0) {
      const { resolve, reject, sql, params } = this.queryQueue.shift()!;
      this.executeQuery(sql, params).then(resolve).catch(reject);
    }
  }
  
  /**
   * 自動同期タイマーのセットアップ
   */
  private setupAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    
    if (!this.config.syncInterval) return;
    
    this.syncIntervalId = setInterval(async () => {
      try {
        console.log('データベース自動同期を開始します...');
        await this.syncDatabaseFromFirebase();
      } catch (err: any) {
        console.error('自動同期エラー:', err.message);
      }
    }, this.config.syncInterval);
    
    console.log(`自動同期が ${this.config.syncInterval / 1000 / 60} 分ごとに設定されました`);
  }

  /**
   * データベース接続を取得
   */
  public connect(): sqlite3.Database {
    if (!this.db) {
      this.db = new sqlite3.Database(this.config.path, (err) => {
        if (err) {
          const errorMessage = `SQLiteデータベース接続エラー: ${err.message}`;
          console.error(errorMessage);
          throw new DatabaseError(errorMessage);
        }
        console.log('SQLiteデータベースに接続しました:', this.config.path);
      });
    }
    return this.db;
  }

  /**
   * 実際のクエリ実行ロジック (Promise化)
   */
  private executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.connect(); // 接続を試みる

        // 開発環境でのみ、詳細なクエリログを出力
        if (process.env.NODE_ENV === 'development') {
          console.log('実行SQL:', sql, '| パラメータ:', params);
        }

        db.all(sql, params, (err, rows) => {
          if (err) {
            // エラーログは開発環境でのみ詳細に出力
            if (process.env.NODE_ENV === 'development') {
              console.error('クエリ実行エラー:', err.message, '| SQL:', sql);
            } else {
              console.error('クエリ実行エラー:', err.message);
            }
            reject(new DatabaseError(err.message));
            return;
          }
          resolve(rows as T[]);
        });
      } catch (connectErr: any) {
        // connect()内で同期的にエラーがスローされた場合 (例: DatabaseError)
        console.error('データベース接続または準備中のエラー:', connectErr.message);
        reject(connectErr);
      }
    });
  }

  /**
   * クエリ実行関数 (同期中はキューイング)
   */
  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.isSyncing) {
      // 同期中の場合はキューに追加
      console.log('同期中のためクエリをキューに追加します:', sql);
      return new Promise((resolve, reject) => {
        this.queryQueue.push({ resolve, reject, sql, params });
      });
    } else {
      // 同期中でなければ直接実行
      return this.executeQuery(sql, params);
    }
  }

  /**
        console.log('実行SQL:', sql, '| パラメータ:', params);
      }
      
      db.all(sql, params, (err, rows) => {
        if (err) {
          // エラーログは開発環境でのみ詳細に出力
          if (process.env.NODE_ENV === 'development') {
            console.error('クエリ実行エラー:', err.message, '| SQL:', sql);
          } else {
            console.error('クエリ実行エラー:', err.message);
          }
          reject(new DatabaseError(err.message));
          return;
        }
        resolve(rows as T[]);
      });
    });
  }

  /**
   * データベース接続を閉じる
   */
  public async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            console.error('SQLiteデータベース切断エラー:', err.message);
            reject(err);
            return;
          }
          console.log('SQLiteデータベース接続を閉じました');
          this.db = null;
          resolve();
        });
      });
    }
    return Promise.resolve();
  }

  /**
   * ページネーション用のヘルパーメソッド
   * 指定されたテーブルからページネーション処理されたデータを取得
   */
  public async queryWithPagination<T>(
    table: string, 
    page: number = 1, 
    limit: number = 10,
    conditions: string = '',
    params: any[] = []
  ): Promise<{ items: T[], totalItems: number, totalPages: number }> {
    // 総アイテム数を取得
    const countQuery = `SELECT COUNT(*) as count FROM ${table} ${conditions ? 'WHERE ' + conditions : ''}`;
    const countResult = await this.query<{ count: number }>(countQuery, params);
    const totalItems = countResult[0].count;
    
    // 総ページ数を計算
    const totalPages = Math.ceil(totalItems / limit);
    
    // ページ番号の検証
    const validPage = Math.max(1, Math.min(page, totalPages || 1));
    
    // オフセットを計算
    const offset = (validPage - 1) * limit;
    
    // データを取得
    const dataQuery = `
      SELECT * FROM ${table}
      ${conditions ? 'WHERE ' + conditions : ''}
      LIMIT ? OFFSET ?
    `;
    
    const items = await this.query<T>(dataQuery, [...params, limit, offset]);
    
    return {
      items,
      totalItems,
      totalPages
    };
  }
}

// デフォルトのデータベース設定
const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'books.sqlite');
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;

// デフォルトのデータベースインスタンス
// この部分はシングルトンパターンの代わりに、
// 明示的なインスタンス作成を行いつつ、
// アプリケーション全体で共有可能なインスタンスを提供
export const createDatabase = (config?: Partial<DatabaseConfig>): Database => {
  return new Database({
    path: config?.path || SQLITE_DB_PATH
  });
};

// アプリケーションのデフォルトインスタンス
export const db = createDatabase();
