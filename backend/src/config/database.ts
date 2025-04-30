import path from 'path';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import { dirname } from 'path';
import { DatabaseError } from '../utils/errorHandler';
import { FirebaseService, createFirebaseService } from '../services/firebaseService';

/**
 * データベース種別
 */
export enum DatabaseType {
  BOOKS = 'books',
  EMBEDDINGS = 'embeddings'
}

/**
 * データベース設定インターフェース
 */
export interface DatabaseConfig {
  path: string;
  type: DatabaseType;         // データベースの種類
  autoSync?: boolean;         // Firebase自動同期の有効/無効
  syncInterval?: number;      // 自動同期の間隔（ミリ秒）
  syncWithFirebase?: boolean; // Firebaseとの同期を行うかどうか
}

/**
 * データベース接続を管理するクラス
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
    // デフォルト設定とマージ
    this.config = {
      autoSync: process.env.DB_AUTO_SYNC === 'true',
      syncInterval: parseInt(process.env.DB_SYNC_INTERVAL || '86400000', 10), // デフォルト24時間
      syncWithFirebase: config.type === DatabaseType.BOOKS, // 書籍DBのみデフォルトでFirebase同期
      ...config
    };

    // Firebaseとの同期が有効で、必要な環境変数が設定されている場合のみ初期化
    if (this.config.syncWithFirebase && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_STORAGE_BUCKET) {
      try {
        this.firebaseService = createFirebaseService();
        console.log(`Firebaseサービスが初期化されました (${this.config.type})`);
      } catch (err: any) {
        console.error(`Firebaseサービスの初期化に失敗しました (${this.config.type}):`, err.message);
        this.firebaseService = null;
      }
    }

    this.ensureDatabaseDirectory();
    
    // 初期同期の実行（同期が有効な場合のみ）
    if (this.config.syncWithFirebase && this.firebaseService) {
      this.syncDatabaseFromFirebase().catch(err => {
        console.error(`初期データベース同期エラー (${this.config.type}):`, err.message);
      });
    }
    
    // 自動同期の設定（同期が有効な場合のみ）
    if (this.config.syncWithFirebase && this.config.autoSync && this.config.syncInterval && this.firebaseService) {
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
   * 接続状態を検証し、必要に応じて再接続する
   */
  public connect(): sqlite3.Database {
    // 接続状態を検証
    if (this.db) {
      try {
        // 簡易的な接続テスト（軽量なSQLを実行してみる）
        const stmt = this.db.prepare('SELECT 1');
        stmt.finalize();
        return this.db;
      } catch (err) {
        // 接続テスト失敗の場合はログ出力し、再接続を試みる
        console.warn('既存のデータベース接続が無効です。再接続します。', err);
        this.db = null;
      }
    }

    // 新しい接続の作成（または再接続）
    console.log(`データベースに接続しています: ${this.config.path}`);
    try {
      this.db = new sqlite3.Database(this.config.path, (err) => {
        if (err) {
          const errorMessage = `SQLiteデータベース接続エラー: ${err.message}`;
          console.error(errorMessage);
          throw new DatabaseError(errorMessage);
        }
        console.log('SQLiteデータベースに接続しました:', this.config.path);
      });
      return this.db;
    } catch (err: any) {
      console.error('データベース接続の作成中にエラーが発生しました:', err);
      throw new DatabaseError(`データベース接続エラー: ${err.message}`);
    }
  }

  /**
   * 実際のクエリ実行ロジック (Promise化)
   * タイムアウト機能とエラーハンドリングを強化
   */
  private executeQuery<T>(sql: string, params: any[] = [], timeout: number = 10000): Promise<T[]> {
    return new Promise((resolve, reject) => {
      // クエリのタイムアウト処理
      let isTimedOut = false;
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        reject(new DatabaseError(`クエリがタイムアウトしました (${timeout}ms): ${sql}`));
      }, timeout);

      try {
        // 接続を取得（状態検証付き）
        const db = this.connect();

        // ログ出力（開発環境のみ詳細に）
        if (process.env.NODE_ENV === 'development') {
          console.log('実行SQL:', sql, '| パラメータ:', params);
        } else {
          // 本番環境では簡易ログのみ
          console.log('SQLクエリ実行:', sql.substring(0, 50) + (sql.length > 50 ? '...' : ''));
        }

        // クエリ実行
        db.all(sql, params, (err, rows) => {
          // タイムアウト処理をクリア
          clearTimeout(timeoutId);
          
          // タイムアウト済みの場合は処理しない
          if (isTimedOut) return;

          if (err) {
            // エラーログは開発環境でのみ詳細に出力
            if (process.env.NODE_ENV === 'development') {
              console.error('クエリ実行エラー:', err.message, '| SQL:', sql);
            } else {
              console.error('クエリ実行エラー:', err.message);
            }
            reject(new DatabaseError(err.message, { sql, params }));
            return;
          }
          
          // 結果を返す
          resolve(rows as T[]);
        });
      } catch (connectErr: any) {
        // タイムアウト処理をクリア
        clearTimeout(timeoutId);
        
        // タイムアウト済みの場合は処理しない
        if (isTimedOut) return;
        
        // connect()内で同期的にエラーがスローされた場合
        console.error('データベース接続または準備中のエラー:', connectErr.message);
        reject(connectErr instanceof DatabaseError ? 
          connectErr : 
          new DatabaseError(`データベース接続エラー: ${connectErr.message}`, { sql, params }));
      }
    });
  }

  /**
   * クエリ実行関数 (同期中はキューイング)
   * リトライメカニズムとエラーハンドリングを強化
   */
  public async query<T>(sql: string, params: any[] = [], options: { 
    timeout?: number;
    retries?: number; 
    retryDelay?: number;
  } = {}): Promise<T[]> {
    // オプションのデフォルト値
    const timeout = options.timeout || 10000;  // デフォルト10秒
    const maxRetries = options.retries || 3;   // デフォルト3回リトライ
    const retryDelay = options.retryDelay || 500; // デフォルト500ms

    // 同期中の場合はキューに追加
    if (this.isSyncing) {
      console.log('同期中のためクエリをキューに追加します:', sql.substring(0, 50) + (sql.length > 50 ? '...' : ''));
      return new Promise((resolve, reject) => {
        this.queryQueue.push({ resolve, reject, sql, params });
      });
    }

    // リトライロジック
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 最初の試行以外は少し待機
        if (attempt > 0) {
          console.log(`クエリ再試行 (${attempt}/${maxRetries}):`, sql.substring(0, 50) + (sql.length > 50 ? '...' : ''));
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
        
        // クエリ実行
        return await this.executeQuery<T>(sql, params, timeout);
      } catch (err) {
        lastError = err;
        
        // 特定のエラーは再試行する価値があるかを判断
        const isRetryableError = err instanceof Error && 
          (err.message.includes('database is locked') || 
           err.message.includes('busy') ||
           err.message.includes('no such table'));
        
        if (!isRetryableError || attempt === maxRetries) {
          // 再試行可能でないエラー、または最後の試行だった場合
          console.error(`クエリ失敗 (${attempt + 1}/${maxRetries + 1}):`, err);
          throw err;
        }
      }
    }
    
    // このコードは実行されないはずだが、TypeScriptの型チェックのために必要
    throw lastError;
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

// データベースパスと設定
const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'books.sqlite');
const DEFAULT_CACHE_DB_PATH = path.join(process.cwd(), 'data', 'embeddings_cache.sqlite');

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;
const EMBEDDING_CACHE_DB_PATH = process.env.EMBEDDING_CACHE_DB_PATH || DEFAULT_CACHE_DB_PATH;

// データベース管理のシングルトン
class DatabaseManager {
  private static instance: DatabaseManager;
  private databases: Map<DatabaseType, Database> = new Map();

  private constructor() {
    // 書籍データベース
    this.databases.set(DatabaseType.BOOKS, new Database({
      path: SQLITE_DB_PATH,
      type: DatabaseType.BOOKS
    }));

    // 埋め込みキャッシュデータベース
    this.databases.set(DatabaseType.EMBEDDINGS, new Database({
      path: EMBEDDING_CACHE_DB_PATH,
      type: DatabaseType.EMBEDDINGS,
      syncWithFirebase: false // キャッシュはFirebaseと同期しない
    }));
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getDatabase(type: DatabaseType): Database {
    const db = this.databases.get(type);
    if (!db) {
      throw new Error(`データベース ${type} が見つかりません`);
    }
    return db;
  }

  public async closeAll(): Promise<void> {
    for (const [type, db] of this.databases.entries()) {
      try {
        await db.close();
        console.log(`${type} データベース接続を閉じました`);
      } catch (err) {
        console.error(`${type} データベース接続のクローズに失敗しました:`, err);
      }
    }
  }
}

// データベース取得用関数
export const getDatabase = (type: DatabaseType): Database => {
  return DatabaseManager.getInstance().getDatabase(type);
};

// すべてのデータベース接続を閉じる
export const closeAllDatabases = async (): Promise<void> => {
  await DatabaseManager.getInstance().closeAll();
};
