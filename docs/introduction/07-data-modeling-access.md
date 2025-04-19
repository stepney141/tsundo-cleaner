# データモデリングとデータアクセス

## 概要

tsundo-cleanerは、ユーザーの読書リスト（読みたい本リストと積読リスト）と、それらの本に関する詳細情報を扱います。このセクションでは、アプリケーションで使用されているデータモデルの設計と、データベースアクセス層の実装について詳しく解説します。

## データモデルの設計

### 基本的なエンティティ

tsundo-cleanerの中心となるエンティティは「Book（書籍）」です。書籍は以下の情報を持ちます：

1. **基本情報**: タイトル、著者、出版社、出版日など
2. **識別情報**: 読書メーターURL、ISBN/ASINなど
3. **図書館所蔵情報**: 東京大学と上智大学での所蔵状況
4. **OPAC（蔵書検索システム）リンク**: 各図書館での検索リンク
5. **説明文**: 書籍の内容や概要の説明

### TypeScriptによるデータモデル定義

```typescript
// Book.ts - 書籍データモデル
/**
 * データベース内の書籍データモデル（DB形式）
 * データベースでは真偽値が'Yes'/'No'として格納されています
 */
export interface BookDB {
  bookmeter_url: string;       // 読書メーターURL (プライマリキー)
  isbn_or_asin: string;        // ISBN/ASIN
  book_title: string;          // 書籍タイトル
  author: string;              // 著者
  publisher: string;           // 出版社
  published_date: string;      // 出版日
  exist_in_Sophia: string;     // 上智大学にあるか ('Yes'/'No')
  exist_in_UTokyo: string;     // 東京大学にあるか ('Yes'/'No')
  sophia_opac?: string;        // 上智OPACリンク
  utokyo_opac?: string;        // 東大OPACリンク
  sophia_mathlib_opac?: string; // 上智数学図書館OPACリンク
  description?: string;        // 書籍の説明
}

/**
 * アプリケーション内の書籍データモデル（アプリ形式）
 * アプリケーション内では真偽値がbooleanとして扱われます
 */
export interface Book {
  bookmeter_url: string;       // 読書メーターURL (プライマリキー)
  isbn_or_asin: string;        // ISBN/ASIN
  book_title: string;          // 書籍タイトル
  author: string;              // 著者
  publisher: string;           // 出版社
  published_date: string;      // 出版日
  exist_in_Sophia: boolean;    // 上智大学にあるか
  exist_in_UTokyo: boolean;    // 東京大学にあるか
  sophia_opac?: string;        // 上智OPACリンク
  utokyo_opac?: string;        // 東大OPACリンク
  sophia_mathlib_opac?: string; // 上智数学図書館OPACリンク
  description?: string;        // 書籍の説明
}

/**
 * 書籍タイプ
 * wish: 読みたい本リスト
 * stacked: 積読リスト
 */
export type BookType = 'wish' | 'stacked';
```

### データモデルの特徴

#### 1. 二重インターフェース設計

tsundo-cleanerでは、DBレベルとアプリケーションレベルで異なるデータ型を使用しています：

- **BookDB**: データベース格納形式。booleanがYes/No文字列として表現されています
- **Book**: アプリケーション内部での形式。文字列のYes/Noが標準的なbooleanに変換されています

この設計により、SQLiteでのブール値の扱いに関する制約（SQLiteはネイティブなbooleanタイプを持たない）に対応しつつ、アプリケーション内では型安全なbooleanとして扱うことができます。

#### 2. 一意識別子の選択

`bookmeter_url`をプライマリキーとして使用することで、書籍の一意性を保証しています。読書メーターURLは各書籍に固有であり、外部サービスとの連携も容易になります。

#### 3. オプショナルプロパティの活用

TypeScriptの`?`修飾子を使って、存在しない可能性のあるプロパティ（OPACリンクや説明文など）をオプショナルとして定義しています。

```typescript
sophia_opac?: string;        // 上智OPACリンク（オプショナル）
description?: string;        // 書籍の説明（オプショナル）
```

#### 4. リテラル型による制約

`BookType`型は、文字列リテラル型を使って「wish」と「stacked」のみを許容するように定義されています。これにより、型安全性を確保し、誤った値の使用を防止しています。

```typescript
export type BookType = 'wish' | 'stacked';
```

## データベース設計

### SQLiteデータベース

tsundo-cleanerでは、軽量で設定不要なSQLiteデータベースを使用しています。以下のテーブル構造が設計されています：

#### wish テーブル（読みたい本リスト）

```sql
CREATE TABLE wish (
  bookmeter_url TEXT PRIMARY KEY,
  isbn_or_asin TEXT NOT NULL,
  book_title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT NOT NULL,
  published_date TEXT,
  exist_in_Sophia TEXT CHECK(exist_in_Sophia IN ('Yes', 'No')),
  exist_in_UTokyo TEXT CHECK(exist_in_UTokyo IN ('Yes', 'No')),
  sophia_opac TEXT,
  utokyo_opac TEXT,
  sophia_mathlib_opac TEXT,
  description TEXT
);
```

#### stacked テーブル（積読リスト）

```sql
CREATE TABLE stacked (
  bookmeter_url TEXT PRIMARY KEY,
  isbn_or_asin TEXT NOT NULL,
  book_title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT NOT NULL,
  published_date TEXT,
  exist_in_Sophia TEXT CHECK(exist_in_Sophia IN ('Yes', 'No')),
  exist_in_UTokyo TEXT CHECK(exist_in_UTokyo IN ('Yes', 'No')),
  sophia_opac TEXT,
  utokyo_opac TEXT,
  sophia_mathlib_opac TEXT,
  description TEXT
);
```

### データベース接続管理

SQLiteデータベースへの接続は、シングルトンパターンを用いて管理されています。これにより、アプリケーション全体で一貫したデータベース接続を保証し、接続のオーバーヘッドを削減しています。

```typescript
// database.ts - データベース接続管理
import path from 'path';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import { dirname } from 'path';

// データベースファイルへのパス設定
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
```

## データアクセス層の実装

### Promiseベースのクエリ実行関数

SQLiteのコールバックベースのAPIをPromiseで包むことで、非同期プログラミングのモダンな手法（async/await）を使用できるようにしています。

```typescript
// database.ts - Promise化されたクエリ実行関数
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
```

この関数は以下の特徴を持っています：

1. **型パラメータ**: ジェネリック型`T`を使用して、クエリ結果を適切な型にマッピングできます
2. **パラメータ化クエリ**: SQLインジェクション攻撃を防ぐためのプリペアドステートメントをサポート
3. **Promise化**: コールバックをPromiseでラップして、async/awaitで使いやすくしています

### サービス層でのデータアクセス

各サービスクラスでは、上記のクエリ関数を使用してデータベースにアクセスします。以下は書籍サービスの例です：

```typescript
// bookService.ts - 書籍データアクセスサービス
import { Book, BookDB, BookType } from '../models/Book';
import { getDatabase, query } from '../config/database';

export class BookService {
  /**
   * DB形式の書籍データをアプリケーション形式に変換する
   */
  private convertToAppModel(dbBook: BookDB): Book {
    return {
      ...dbBook,
      exist_in_Sophia: dbBook.exist_in_Sophia === 'Yes',
      exist_in_UTokyo: dbBook.exist_in_UTokyo === 'Yes'
    };
  }

  /**
   * 全ての書籍を取得
   */
  async getAllBooks(type: BookType = 'wish'): Promise<Book[]> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      const books = await query<BookDB>(
        db,
        `SELECT * FROM ${type} ORDER BY book_title`
      );
      
      // DB形式からアプリケーション形式に変換
      return books.map(this.convertToAppModel);
    } catch (err: any) {
      console.error(`getAllBooks(${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  /**
   * URLで指定された書籍を取得
   */
  async getBookByUrl(url: string, type: BookType = 'wish'): Promise<Book | null> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      const books = await query<BookDB>(
        db,
        `SELECT * FROM ${type} WHERE bookmeter_url = ?`,
        [url]
      );
      
      if (books.length === 0) {
        return null;
      }
      
      // DB形式からアプリケーション形式に変換
      return this.convertToAppModel(books[0]);
    } catch (err: any) {
      console.error(`getBookByUrl(${url}, ${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }

  /**
   * 書籍検索
   */
  async searchBooks(query: string, type: BookType = 'wish'): Promise<Book[]> {
    const db = getDatabase();
    try {
      // SQLインジェクション防止のため、typeは許可リストで検証
      if (type !== 'wish' && type !== 'stacked') {
        throw new Error(`無効な書籍タイプ: ${type}`);
      }
      
      // 検索語をトリミングして小文字に変換
      const searchTerm = query.trim().toLowerCase();
      
      if (searchTerm === '') {
        return [];
      }
      
      // 複数フィールドでLIKE検索
      const books = await query<BookDB>(
        db,
        `SELECT * FROM ${type} 
         WHERE LOWER(book_title) LIKE ? 
         OR LOWER(author) LIKE ? 
         OR LOWER(publisher) LIKE ?
         ORDER BY book_title
         LIMIT 100`,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
      );
      
      // DB形式からアプリケーション形式に変換
      return books.map(this.convertToAppModel);
    } catch (err: any) {
      console.error(`searchBooks(${query}, ${type})でエラーが発生しました:`, err.message);
      throw err;
    }
  }
}
```

## データ変換とマッピング

### DB形式とアプリケーション形式の変換

データベース形式とアプリケーション形式の間の変換は、各サービスクラスの`convertToAppModel`メソッドで行われます：

```typescript
/**
 * DB形式の書籍データをアプリケーション形式に変換する
 */
private convertToAppModel(dbBook: BookDB): Book {
  return {
    ...dbBook,
    exist_in_Sophia: dbBook.exist_in_Sophia === 'Yes',
    exist_in_UTokyo: dbBook.exist_in_UTokyo === 'Yes'
  };
}
```

この設計により、以下のメリットが得られます：

1. **関心の分離**: データストレージの詳細をアプリケーションロジックから分離
2. **型安全性**: アプリケーション内では適切な型（boolean）で操作
3. **一貫性**: 変換ロジックを一箇所に集中させることで、一貫性を確保

## セキュリティ対策

### SQLインジェクション対策

SQLインジェクション攻撃を防ぐために、以下の対策が実装されています：

1. **パラメータ化クエリ**: すべてのユーザー入力は`?`プレースホルダーを使用して安全にバインド

```typescript
const books = await query<BookDB>(
  db,
  `SELECT * FROM ${type} WHERE bookmeter_url = ?`,
  [url]
);
```

2. **テーブル名の検証**: 動的テーブル名も、許可リストによる厳格な検証を行う

```typescript
// SQLインジェクション防止のため、typeは許可リストで検証
if (type !== 'wish' && type !== 'stacked') {
  throw new Error(`無効な書籍タイプ: ${type}`);
}
```

### エラーハンドリングとロギング

エラー発生時のセキュリティとデバッグを向上させるため、詳細なエラーロギングが実装されています：

```typescript
try {
  // 処理ロジック
} catch (err: any) {
  console.error(`getBookByUrl(${url}, ${type})でエラーが発生しました:`, err.message);
  throw err;
}
```

また、クエリ実行エラー時にはパラメータを含めた詳細なログを出力：

```typescript
db.all(sql, params, (err, rows) => {
  if (err) {
    console.error('クエリ実行エラー:', err.message, '| SQL:', sql, '| パラメータ:', params);
    reject(err);
    return;
  }
  // ...
});
```

## トランザクション管理

SQLiteでは、複数のクエリを一つの原子的な操作としてグループ化するためのトランザクションをサポートしています。以下は、そのような機能を提供するトランザクションヘルパー関数の実装例です：

```typescript
/**
 * トランザクションを開始し、指定したコールバック内の処理を実行
 * 処理が成功した場合はコミット、エラーが発生した場合はロールバック
 */
export const withTransaction = async <T>(
  db: sqlite3.Database,
  callback: () => Promise<T>
): Promise<T> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      callback()
        .then((result) => {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('トランザクションコミットエラー:', err.message);
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            resolve(result);
          });
        })
        .catch((err) => {
          console.error('トランザクション実行エラー:', err.message);
          db.run('ROLLBACK');
          reject(err);
        });
    });
  });
};
```

この関数を使用することで、複数の書籍に関する操作を一つのトランザクションとして処理することができます。例えば、複数の書籍を一括で更新する場合などに有用です。

## リソース管理

アプリケーション終了時に確実にデータベース接続を閉じるための関数も実装されています：

```typescript
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
```

この関数は、Expressアプリケーションのシャットダウンハンドラで呼び出すことができます：

```typescript
// index.ts - アプリケーション終了時の処理
process.on('SIGINT', async () => {
  console.log('アプリケーションを終了しています...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('アプリケーションを終了しています...');
  await closeDatabase();
  process.exit(0);
});
```

## データアクセスパターン

### リポジトリパターン

tsundo-cleanerのデータアクセス層は、リポジトリパターンの簡易版として設計されています。サービスクラスがデータアクセスの責務を担い、データベースの詳細をアプリケーションロジックから分離しています。

より大規模なアプリケーションでは、サービスとリポジトリを明確に分離し、リポジトリに純粋なデータアクセス処理を委譲することも考えられます：

```typescript
// bookRepository.ts - リポジトリパターンの例
export class BookRepository {
  async findAll(type: BookType): Promise<BookDB[]> {
    const db = getDatabase();
    return query<BookDB>(db, `SELECT * FROM ${type}`);
  }
  
  async findByUrl(url: string, type: BookType): Promise<BookDB | null> {
    const db = getDatabase();
    const result = await query<BookDB>(
      db,
      `SELECT * FROM ${type} WHERE bookmeter_url = ?`,
      [url]
    );
    return result.length > 0 ? result[0] : null;
  }
  
  // 他のデータアクセスメソッド...
}

// bookService.ts - サービスとリポジトリの分離
export class BookService {
  private repository: BookRepository;
  
  constructor() {
    this.repository = new BookRepository();
  }
  
  async getAllBooks(type: BookType): Promise<Book[]> {
    const dbBooks = await this.repository.findAll(type);
    return dbBooks.map(this.convertToAppModel);
  }
  
  // 他のビジネスロジックメソッド...
}
```

### データマッパーパターン

`convertToAppModel`メソッドは、データマッパーパターンの一種として機能しています。データベースの表現とドメインオブジェクトの表現を変換する役割を担っています。

## データアクセスの最適化

### インデックスの活用

SQLiteでは、適切なインデックスを作成することで検索パフォーマンスを向上させることができます。例えば、頻繁に検索される著者名や出版社名にインデックスを作成します：

```sql
CREATE INDEX idx_wish_author ON wish(author);
CREATE INDEX idx_wish_publisher ON wish(publisher);
CREATE INDEX idx_stacked_author ON stacked(author);
CREATE INDEX idx_stacked_publisher ON stacked(publisher);
```

### クエリの最適化

パフォーマンスを向上させるため、以下のようなクエリ最適化が可能です：

1. **結果の制限**: 必要な列のみ選択し、結果数も適切に制限
   ```sql
   SELECT book_title, author FROM wish LIMIT 100
   ```

2. **WHERE句の最適化**: 最も選択性の高い条件を先に配置
   ```sql
   SELECT * FROM wish WHERE bookmeter_url = ? AND author = ?
   ```

3. **結合の最小化**: 必要な場合のみテーブル結合を使用

## まとめ

tsundo-cleanerのデータモデルとデータアクセス層は、以下の特徴を持つシンプルかつ効果的な設計となっています：

1. **型安全性**: TypeScriptの型システムを活用して、データの整合性を保証
2. **関心の分離**: データ表現とストレージの詳細をビジネスロジックから分離
3. **Promise/async/await**: モダンな非同期プログラミングパターンを採用
4. **セキュリティ**: SQLインジェクション対策やエラーハンドリングを徹底
5. **効率的なデータアクセス**: 適切なクエリとトランザクション管理

これらの設計原則により、tsundo-cleanerは小規模ながらも、スケーラブルで保守性の高いデータ管理を実現しています。

次のセクションでは、現代的なWeb開発のベストプラクティスとトレンドについて総括します。
