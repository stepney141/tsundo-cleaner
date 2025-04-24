import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseError } from '../utils/errorHandler';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

/**
 * Firebase設定インターフェース
 */
export interface FirebaseConfig {
  projectId: string;
  storageBucket: string;
  databasePath: string;
  apiKey: string;            // Firebase APIキー（必須）
  authDomain: string;        // Firebase認証ドメイン（必須）
  messagingSenderId?: string; // Firebase メッセージ送信者ID
  appId?: string;             // Firebase アプリID
}

/**
 * Firebaseとの連携を管理するサービスクラス
 * ファイルのダウンロードなどの機能を提供
 */
export class FirebaseService {
  private app: any;
  private storage: any;
  private config: FirebaseConfig;
  private initialized: boolean = false;

  /**
   * コンストラクタ - Firebase設定を受け取り初期化
   */
  constructor(config: FirebaseConfig) {
    this.config = config;
    this.initializeFirebase();
  }

  /**
   * Firebaseを初期化する
   */
  private initializeFirebase(): void {
    try {
      // 必須パラメータのチェック
      if (!this.config.apiKey || !this.config.authDomain || !this.config.projectId || !this.config.storageBucket) {
        throw new Error('Firebase設定が不完全です。apiKey, authDomain, projectId, storageBucketは必須です。');
      }

      // Firebaseクライアントアプリケーションの初期化
      this.app = initializeApp({
        apiKey: this.config.apiKey,
        authDomain: this.config.authDomain,
        projectId: this.config.projectId,
        storageBucket: this.config.storageBucket,
        messagingSenderId: this.config.messagingSenderId,
        appId: this.config.appId
      });
      
      this.storage = getStorage(this.app);
      this.initialized = true;
      console.log('Firebase Storageに接続しました');
    } catch (err: any) {
      console.error(`Firebase初期化エラー: ${err.message}`);
      console.error('詳細: https://firebase.google.com/docs/web/setup');
      // 初期化失敗時は標識を設定
      this.initialized = false;
      throw new DatabaseError(`Firebaseの初期化に失敗しました: ${err.message}`);
    }
  }

  /**
   * Firebase Storageからファイルのメタデータを取得する方法は
   * クライアントSDKでは直接サポートされていないため、
   * 代わりにファイルの存在確認とダウンロードURLの有効性をチェックします
   */
  public async checkFileExists(): Promise<boolean> {
    if (!this.initialized) {
      console.warn('Firebase Storageが初期化されていません');
      return false;
    }

    try {
      const fileRef = ref(this.storage, this.config.databasePath);
      // ダウンロードURLを取得してファイルの存在を確認
      await getDownloadURL(fileRef);
      return true;
    } catch (err: any) {
      console.error(`Firebaseファイル存在確認エラー: ${err.message}`);
      return false;
    }
  }

  /**
   * Firebase StorageからSQLiteファイルをダウンロード
   * @returns ダウンロードしたファイルのパス
   */
  public async downloadDatabase(localDbPath: string): Promise<string> {
    if (!this.initialized) {
      throw new DatabaseError('Firebase Storageが初期化されていません');
    }

    try {
      // ダウンロード先ディレクトリの存在確認
      const dbDir = path.dirname(localDbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // ダウンロードURLの取得
      const fileRef = ref(this.storage, this.config.databasePath);
      const downloadURL = await getDownloadURL(fileRef);

      // 一時ファイル名を生成
      const tempFilePath = `${localDbPath}.downloading`;

      // ストリームでファイルをダウンロード
      const response = await axios({
        method: 'GET',
        url: downloadURL,
        responseType: 'stream',
      });

      // ファイルに書き込み
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);

      return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => {
          // ダウンロード完了後、ファイル名を変更
          try {
            // 既存のファイルが存在する場合は削除
            if (fs.existsSync(localDbPath)) {
              fs.unlinkSync(localDbPath);
            }
            fs.renameSync(tempFilePath, localDbPath);
            console.log(`SQLiteデータベースをFirebaseからダウンロードしました: ${localDbPath}`);
            resolve(localDbPath);
          } catch (err: any) {
            reject(new DatabaseError(`ファイル名変更エラー: ${err.message}`));
          }
        });

        writer.on('error', (err) => {
          // エラー発生時は一時ファイルを削除
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          reject(new DatabaseError(`ファイルダウンロードエラー: ${err.message}`));
        });
      });
    } catch (err: any) {
      throw new DatabaseError(`データベースダウンロードエラー: ${err.message}`);
    }
  }

  /**
   * ローカルのデータベースが更新が必要かどうかを判断
   * クライアントSDKではメタデータの更新時間を直接取得できないため、
   * ファイルの存在チェックとローカルファイルのタイムスタンプを比較して判断
   * 
   * @param localDbPath ローカルデータベースのパス
   * @returns 更新が必要な場合はtrue
   */
  public async shouldUpdateDatabase(localDbPath: string): Promise<boolean> {
    if (!this.initialized) {
      // Firebase初期化に失敗している場合は更新の必要なし
      console.warn('Firebase Storageが初期化されていないため、ローカルデータベースを使用します');
      return false;
    }

    try {
      // ローカルファイルが存在しない場合は更新が必要
      if (!fs.existsSync(localDbPath)) {
        console.log('ローカルのデータベースファイルが存在しないため、ダウンロードが必要です');
        return true;
      }

      // Firebaseにファイルが存在するか確認
      const fileExists = await this.checkFileExists();
      if (!fileExists) {
        console.warn('Firebaseにファイルが存在しません');
        return false;
      }

      // クライアントSDKではFirebaseファイルの最終更新時間を直接取得できないため、
      // 一定期間ごとに更新するようにする（例：24時間ごと）
      const localStats = fs.statSync(localDbPath);
      const localUpdatedTime = localStats.mtime.getTime();
      const currentTime = Date.now();
      
      // 24時間（86400000ミリ秒）以上経過している場合は更新する
      // ここは環境変数などで設定可能にしてもよい
      const updateInterval = parseInt(process.env.DB_SYNC_INTERVAL || '86400000');
      return (currentTime - localUpdatedTime) > updateInterval;
    } catch (err: any) {
      console.error(`データベース更新チェックエラー: ${err.message}`);
      // エラーの場合は安全のため更新なしとする
      return false;
    }
  }

  /**
   * Firebaseへの接続が成功しているかどうかを確認
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * デフォルトのFirebase設定
 */
export const getDefaultFirebaseConfig = (): FirebaseConfig => {
  // すべての必須項目を環境変数から取得
  const apiKey = process.env.FIREBASE_API_KEY;
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  
  if (!apiKey || !authDomain || !projectId || !storageBucket) {
    console.warn('Firebase設定が不完全です。.envファイルを確認してください。');
  }
  
  return {
    apiKey: apiKey || '',
    authDomain: authDomain || '',
    projectId: projectId || '',
    storageBucket: storageBucket || '',
    databasePath: process.env.FIREBASE_DATABASE_PATH || 'books.sqlite',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };
};

/**
 * FirebaseServiceのインスタンスを作成する関数
 */
export const createFirebaseService = (config?: Partial<FirebaseConfig>): FirebaseService => {
  const defaultConfig = getDefaultFirebaseConfig();
  return new FirebaseService({
    ...defaultConfig,
    ...config,
  });
};
