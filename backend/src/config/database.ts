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
    
    try {
      // 更新が必要かチェック
      const needsUpdate = await this.firebaseService.shouldUpdateDatabase(this.config.path);
      
      if (needsUpdate) {
        console.log('データベースの更新が必要です。Firebaseからダウンロードを開始します...');
        
        // 既存の接続があれば閉じる
        if (this.db) {
          await this.close();
        }
        
        // ダウンロード実行
        await this.firebaseService.downloadDatabase(this.config.path);
        console.log(`データベースを更新しました: ${this.config.path}`);
        
        // 再接続（必要な場合）
        if (this.db) {
          this.connect();
        }
        
        return true;
      } else {
        console.log('データベースは最新の状態です');
        return false;
      }
    } catch (err: any) {
      console.error('データベース同期エラー:', err.message);
      // エラー時はローカルファイルを使用する
      console.log('ローカルのデータベースファイルを使用します');
      return false;
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
   * Promise化されたクエリ実行関数
   */
  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const db = this.connect();
    
    return new Promise((resolve, reject) => {
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
