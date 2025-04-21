# Firebase同期機能の実装

## 概要

本改修では、`books.sqlite`ファイルをFirebase Storageから動的にダウンロードする機能を実装しました。これにより、データベースの一元管理が可能になり、複数のデプロイ環境間でのデータ共有、バックアップ/復元が容易になります。

## 実装詳細

### 1. 追加したパッケージ

- `firebase-admin`: Firebase Storageへのアクセスと認証
- `axios`: HTTPリクエストによるファイルダウンロード

### 2. FirebaseServiceの実装

`FirebaseService`クラスを実装し、以下の機能を提供します：

- Firebase Storageへの接続
- ファイルメタデータの取得
- データベースファイルのダウンロード
- 更新の必要性を判断するロジック

```typescript
// src/services/firebaseService.ts
export class FirebaseService {
  // Firebaseの初期化とストレージ接続
  private initializeFirebase(): void;
  
  // メタデータ取得
  public async getFileMetadata(): Promise<any | null>;
  
  // データベースダウンロード
  public async downloadDatabase(localDbPath: string): Promise<string>;
  
  // 更新が必要かチェック
  public async shouldUpdateDatabase(localDbPath: string): Promise<boolean>;
}
```

### 3. Databaseクラスの拡張

既存の`Database`クラスを拡張し、以下の機能を追加しました：

- FirebaseServiceとの連携
- 起動時のデータベース同期
- 定期的な自動同期（オプション）
- エラー発生時のフォールバック処理

```typescript
// src/config/database.ts
export class Database {
  // 既存の機能
  // ...
  
  // 新しい同期機能
  public async syncDatabaseFromFirebase(): Promise<boolean>;
  private setupAutoSync(): void;
}
```

### 4. 環境設定の追加

以下の環境変数を追加し、Firebase連携と同期動作を制御します：

```
# Firebase設定
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_DATABASE_PATH=books.sqlite
FIREBASE_CREDENTIALS_PATH=firebase-credentials.json

# データベース同期設定
DB_AUTO_SYNC=true
DB_SYNC_INTERVAL=86400000  # 24時間（ミリ秒）
```

## 動作フロー

1. アプリケーション起動時：
   - DatabaseクラスがFirebaseServiceを初期化（Firebase設定が存在する場合）
   - 初回同期の実行（`syncDatabaseFromFirebase`メソッド）
   - 自動同期の設定（設定されている場合）

2. データベース同期プロセス：
   - ローカルファイルとFirebase上のファイルのタイムスタンプ比較
   - 更新が必要な場合、既存のデータベース接続を閉じる
   - Firebaseからファイルをダウンロード
   - データベース再接続（必要な場合）

3. エラー処理：
   - Firebase接続エラー時はローカルファイルを使用
   - ダウンロードエラー時は既存ファイルを維持
   - 同期失敗のログ記録

## セキュリティ考慮事項

- Firebaseサービスアカウント認証情報は安全に保管
- 環境変数での設定を推奨
- 開発環境と本番環境で異なる認証情報を使用可能

## 展望

今後の改善点として以下が考えられます：

1. アップロード機能の追加（管理者向け）
2. 差分同期機能（変更があった部分だけを更新）
3. 手動同期のUIコントロール追加
4. 同期ステータスの監視と通知機能
