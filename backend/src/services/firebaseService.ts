import * as admin from 'firebase-admin';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseError } from '../utils/errorHandler';

/**
 * Firebase設定インターフェース
 */
export interface FirebaseConfig {
  projectId: string;
  storageBucket: string;
  databasePath: string;
  credentialsPath?: string;
  credentialsJson?: admin.ServiceAccount;
}

/**
 * Firebaseとの連携を管理するサービスクラス
 * ファイルのダウンロードなどの機能を提供
 */
export class FirebaseService {
  private storage!: admin.storage.Storage;
  private bucket!: any; // firebase-adminの型定義の問題を回避
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
      // すでに初期化されている場合は何もしない
      if (admin.apps.length > 0) {
        const app = admin.apps[0];
        if (app) {
          this.storage = admin.storage();
          this.bucket = this.storage.bucket(this.config.storageBucket);
          this.initialized = true;
          return;
        }
      }

      // 認証情報の設定
      let credential: admin.credential.Credential;
      
      if (this.config.credentialsJson) {
        // 直接JSONオブジェクトから認証情報を作成
        credential = admin.credential.cert(this.config.credentialsJson);
      } else if (this.config.credentialsPath) {
        // ファイルから認証情報を読み込む
        try {
          const serviceAccount = JSON.parse(
            fs.readFileSync(this.config.credentialsPath, 'utf8')
          );
          credential = admin.credential.cert(serviceAccount);
        } catch (err: any) {
          console.error(`Firebase認証情報の読み込みエラー: ${err.message}`);
          throw new DatabaseError(`Firebase認証情報の読み込みに失敗しました: ${err.message}`);
        }
      } else {
        // 環境変数またはデフォルト認証情報を使用
        credential = admin.credential.applicationDefault();
      }

      // Firebaseアプリケーションの初期化
      admin.initializeApp({
        credential,
        storageBucket: this.config.storageBucket,
        projectId: this.config.projectId,
      });

      this.storage = admin.storage();
      this.bucket = this.storage.bucket(this.config.storageBucket);
      this.initialized = true;
      console.log('Firebase Storageに接続しました');
    } catch (err: any) {
      console.error(`Firebase初期化エラー: ${err.message}`);
      // 初期化失敗時は標識を設定
      this.initialized = false;
      throw new DatabaseError(`Firebaseの初期化に失敗しました: ${err.message}`);
    }
  }

  /**
   * Firebase Storageからメタデータを取得
   */
  public async getFileMetadata(): Promise<any | null> {
    if (!this.initialized) {
      console.warn('Firebase Storageが初期化されていません');
      return null;
    }

    try {
      const file = this.bucket.file(this.config.databasePath);
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (err: any) {
      console.error(`Firebaseメタデータ取得エラー: ${err.message}`);
      return null;
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

      // 署名付きURLの取得
      const file = this.bucket.file(this.config.databasePath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15分間有効
      });

      // 一時ファイル名を生成
      const tempFilePath = `${localDbPath}.downloading`;

      // ストリームでファイルをダウンロード
      const response = await axios({
        method: 'GET',
        url: signedUrl,
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

      // Firebaseのメタデータを取得
      const metadata = await this.getFileMetadata();
      if (!metadata) {
        console.warn('Firebaseにファイルが存在しないか、メタデータが取得できません');
        return false;
      }

      // ローカルファイルの最終更新日時を取得
      const localStats = fs.statSync(localDbPath);
      const localUpdatedTime = localStats.mtime.getTime();

      // Firebaseファイルの最終更新日時を取得
      const firebaseUpdatedTime = new Date(metadata.updated).getTime();

      // 最終更新日時を比較
      return firebaseUpdatedTime > localUpdatedTime;
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
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    databasePath: process.env.FIREBASE_DATABASE_PATH || 'books.sqlite',
    credentialsPath: process.env.FIREBASE_CREDENTIALS_PATH,
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
