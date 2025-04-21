# tsundo-cleaner リファクタリング 実装内容

## 概要

tsundo-cleanerプロジェクトのコードレビューに基づき、以下の観点から改善を実施しました：

1. アーキテクチャの簡素化
2. 関数型アプローチの適用
3. 型共有の仕組み導入
4. エラーハンドリングの強化
5. セキュリティ対策の改善
6. パフォーマンスの最適化

これらの改善により、コードの保守性、拡張性、安全性が大幅に向上しました。

## 1. 共通型定義の導入

バックエンドとフロントエンドで重複していた型定義を共通化するため、`shared/types`ディレクトリを新設し、共有型を定義しました。

```typescript
// shared/types/Book.ts
export interface Book {
  // ...共通の型定義
}

export type BookType = 'wish' | 'stacked';

// ページネーション関連の型も追加
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  // ...
}

// 統計情報関連の型
export interface PublisherDistribution {
  // ...
}
```

この変更により、フロントエンドとバックエンドで型の整合性が保証され、変更管理が容易になりました。

## 2. データベース接続管理の改善

シングルトンパターンから依存性注入を活用した設計に変更しました。

```typescript
// 改善前: グローバル変数とシングルトンパターン
let dbPool: sqlite3.Database | null = null;
export const getDatabase = () => {
  if (dbPool === null) { /* ... */ }
  return dbPool;
};

// 改善後: クラスベースの設計と純粋関数の組み合わせ
export class Database {
  private readonly config: DatabaseConfig;
  private db: sqlite3.Database | null = null;
  
  // ...メソッド実装
  
  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    // ...改善されたクエリ実行
  }
  
  public async queryWithPagination<T>(...): Promise<{ items: T[], totalItems: number, totalPages: number }> {
    // ...ページネーション機能
  }
}

// アプリケーションのデフォルトインスタンス
export const db = createDatabase();
```

主な改善点：
- 依存性注入を可能にすることでテスト容易性の向上
- ページネーション機能の追加
- 安全なエラーハンドリング
- 環境に応じた適切なログ出力

## 3. サービス層の関数型アプローチ適用

クラスベースのサービスから純粋関数群へのリファクタリングを実施しました。

```typescript
// 改善前: クラスベースのサービス
export class BookService {
  private convertToAppModel(dbBook: BookDB): Book {
    // ...
  }
  
  async getAllBooks(type: BookType): Promise<Book[]> {
    // ...
  }
  // ...
}

// 改善後: 関数型アプローチ
export const convertToAppModel = (dbBook: BookDB): Book => ({
  // ...pure function
});

export const getAllBooks = async (
  type: BookType,
  pagination?: PaginationParams
): Promise<PaginatedResult<Book>> => {
  // ...
};
```

主な改善点：
- 純粋関数の優先による予測可能性の向上
- 個別の関数にすることで再利用性の向上
- 型安全性の強化
- ページネーション対応

## 4. エラーハンドリングの強化

集中型エラーハンドリングシステムを実装し、全アプリケーションで一貫したエラー処理を可能にしました。

```typescript
// 集中型エラーハンドリング機構
export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  // ...
}

export class ValidationError extends AppError { /* ... */ }
export class NotFoundError extends AppError { /* ... */ }
export class DatabaseError extends AppError { /* ... */ }

// エラーハンドリングミドルウェア
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // ...環境に応じた適切なエラーレスポンス
}

// 非同期ルートハンドラのラッパー
export function wrapAsync(fn: Function) {
  return function(req: Request, res: Response, next: NextFunction) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

主な改善点：
- 構造化されたエラーレスポンス
- 環境に応じた適切なエラー情報の出力
- 非同期エラーの適切な捕捉

## 5. セキュリティ対策の改善

CORS設定の最適化など、セキュリティ対策を強化しました。

```typescript
// 本番環境では適切なCORS設定
if (process.env.NODE_ENV === 'production') {
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    [`http://${serverConfig.host}:${serverConfig.port}`];
  
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    // ...その他の設定
  }));
} else {
  // 開発環境では全てのオリジンを許可
  app.use(cors());
}
```

また、SQLクエリのログ出力も環境に応じて制御するようにしました：

```typescript
// 開発環境でのみ、詳細なクエリログを出力
if (process.env.NODE_ENV === 'development') {
  console.log('実行SQL:', sql, '| パラメータ:', params);
}
```

## 6. パフォーマンス最適化

ページネーション機能の実装と最適化されたクエリ処理により、パフォーマンスを向上させました。

```typescript
public async queryWithPagination<T>(
  table: string, 
  page: number = 1, 
  limit: number = 10,
  conditions: string = '',
  params: any[] = []
): Promise<{ items: T[], totalItems: number, totalPages: number }> {
  // 総アイテム数を取得
  const countQuery = `SELECT COUNT(*) as count FROM ${table} ${conditions ? 'WHERE ' + conditions : ''}`;
  // ...効率的なページネーション処理
}
```

主な改善点：
- 必要なデータのみを取得するページネーション
- 適切なクエリとインデックスの活用
- 不要なデータ変換の削減

## 7. グレースフルシャットダウンの実装

アプリケーションの安全な終了処理を実装し、リソースリークを防止しました。

```typescript
// プロセス終了時の処理
const gracefulShutdown = async () => {
  console.log('アプリケーションを終了しています...');
  
  // サーバーのシャットダウン
  server.close(async () => {
    // データベース接続を閉じる
    try {
      await db.close();
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
```

## まとめ

今回のリファクタリングにより、以下の改善が実現しました：

1. コードの保守性と拡張性の向上
2. 関数型アプローチによる堅牢性の向上
3. エラーハンドリングの強化
4. パフォーマンスとスケーラビリティの向上
5. セキュリティ対策の強化

これらの改善は、`.clinerules` で推奨されていた「関数型アプローチ」「純粋関数の優先」「不変データ構造の使用」「副作用の分離」「型安全性の確保」の原則に沿ったもので、プロジェクトの設計品質を大幅に向上させました。
