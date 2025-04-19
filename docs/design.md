# tsundo-cleaner 設計書

## 要件定義

### 目的
- 積読本・読みたい本の中から「今週読むべき本」を推薦するWebアプリケーション
- 特定の本に似た本を推薦する機能
- 読書傾向（興味傾向）の可視化

### 機能要件
1. 基本機能
   - 「UTokyoにある本」「Sophiaにある本」「どちらにもない本」の優先順位で毎週1冊の本を推薦
   - 任意の本を入力すると、それに似ている積読本・読みたい本を表示
   - 読書傾向の可視化（ジャンル分布、時系列変化など）

2. フロントエンド
   - TypeScriptを使用したReactアプリケーション
   - SPA構造（React Router）
   - レスポンシブデザイン
   - Rechartsを使用した可視化コンポーネント

3. バックエンド
   - RESTful API
   - 推薦エンジン
   - 類似度計算モジュール
   - SQLiteデータベース連携

## システム設計

### アーキテクチャ概要

```
Frontend (Vite + React + TypeScript)
├── UI Components
│   ├── WeeklyRecommendation
│   ├── SimilarBooks
│   └── Statistics
└── API Client

Backend (Express + TypeScript)
├── API Routes
├── Controllers
├── Services
│   ├── BookService
│   ├── RecommendationService
│   ├── SimilarityService
│   └── StatisticsService
└── Data Access Layer
    └── SQLite Database
```

### データモデル

```typescript
/**
 * データベース内の書籍データモデル（DB形式）
 * データベースでは真偽値が'Yes'/'No'として格納される
 */
interface BookDB {
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
 * アプリケーション内では真偽値がbooleanとして扱われる
 */
interface Book {
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
type BookType = 'wish' | 'stacked';
```

## API設計

| エンドポイント | メソッド | 説明 | パラメータ | レスポンス |
|--------------|--------|------|-----------|----------|
| /api/books | GET | 全ての書籍を取得 | type (クエリパラメータ) | 書籍オブジェクトの配列 |
| /api/book | GET | URLで指定された書籍を取得 | url (クエリパラメータ) | 書籍オブジェクト |
| /api/books/search | GET | 書籍検索 | query, type (クエリパラメータ) | 書籍オブジェクトの配列 |
| /api/books/weekly | GET | 今週のおすすめ本を取得 | なし | 書籍オブジェクト |
| /api/books/recommend-by-genre | GET | ジャンル別推薦書籍を取得 | type, genreType, genreValue (クエリパラメータ) | 書籍オブジェクト |
| /api/books/similar | GET | 類似書籍を取得 | url, type, limit (クエリパラメータ) | 書籍オブジェクトの配列 |
| /api/stats/publishers | GET | 出版社別分布統計を取得 | type (クエリパラメータ) | 統計データ |
| /api/stats/authors | GET | 著者別分布統計を取得 | type (クエリパラメータ) | 統計データ |
| /api/stats/years | GET | 出版年別分布統計を取得 | type (クエリパラメータ) | 統計データ |
| /api/stats/libraries | GET | 図書館所蔵状況の分布を取得 | type (クエリパラメータ) | 統計データ |

## フロントエンド設計

### ページ構成
1. ホームページ（今週のおすすめ本）
2. 類似書籍検索ページ
3. 読書傾向可視化ページ

### コンポーネント設計
- App: アプリケーションのルートコンポーネント
- Layout: ページレイアウト（ヘッダー、フッター、ナビゲーション）
- BookCard: 書籍情報表示カード
- WeeklyRecommendation: 週間おすすめ本コンポーネント
- SimilarBooks: 類似書籍表示セクション
- BookSearch: 書籍検索フォーム
- StatsPage: 読書傾向可視化ページ

## バックエンド設計

### ディレクトリ構造
```
backend/
├── src/
│   ├── index.ts            # エントリーポイント
│   ├── config/             # 設定
│   │   ├── database.ts     # データベース接続設定
│   │   └── server.ts       # サーバー設定
│   ├── controllers/        # APIコントローラー
│   │   ├── bookController.ts
│   │   ├── similarityController.ts
│   │   └── statisticsController.ts
│   ├── models/             # データモデル
│   │   └── Book.ts
│   ├── routes/             # APIルート定義
│   │   └── api.ts
│   ├── services/           # ビジネスロジック
│   │   ├── bookService.ts
│   │   ├── recommendationService.ts
│   │   ├── similarityService.ts
│   │   └── statisticsService.ts
│   └── utils/              # ユーティリティ関数
├── package.json
└── tsconfig.json
```

### サービス層設計

#### BookService
- 書籍の基本操作機能を提供
- データベースからの書籍取得とフィルタリング
- BookDBからBookへの変換処理

#### RecommendationService
- 推薦アルゴリズムを実装
- 優先順位に基づく推薦（UTokyo > Sophia > その他）
- ジャンル（著者/出版社）に基づく推薦

#### SimilarityService
- 書籍の類似度計算機能を提供
- TF-IDFを使用した説明文ベースの類似度計算
- タイトルと著者に基づくフォールバック検索機能

#### StatisticsService
- 読書傾向の集計・分析
- 出版社別分布
- 著者別分布
- 出版年別分布
- 図書館所蔵状況の分布

### 推薦アルゴリズム
1. 優先順位に基づく推薦
   - UTokyoにある本を優先
   - 次にSophiaにある本
   - 最後にどちらにもない本
   - ランダム性も考慮して毎週異なる本を推薦（週番号を使用）

2. 類似度計算（TF-IDF）
   - 書籍の説明文（description）を使用
   - 重要単語の抽出と重み付け
   - バックアップとして、タイトルと著者の一致度による類似度計算

## 実装計画

### フェーズ1: プロジェクト初期化とデータ連携
1. フロントエンドプロジェクト作成（Vite + React + TypeScript）
2. バックエンドプロジェクト作成（Express + TypeScript）
3. SQLiteデータベース連携とデータモデル実装
4. 基本APIエンドポイント実装

### フェーズ2: 推薦エンジンと類似度計算
1. 推薦アルゴリズム実装（優先順位ベース）
2. 類似度計算モジュール実装（TF-IDF）
3. APIエンドポイント完成

### フェーズ3: フロントエンド実装
1. UIコンポーネント実装
2. ルーティング設定
3. APIとの連携実装

### フェーズ4: 可視化コンポーネント
1. 出版社別分布グラフ実装
2. 著者別分布グラフ実装
3. 出版年別分布グラフ実装
4. 図書館所蔵状況グラフ実装

### フェーズ5: 統合テストと調整
1. エンドツーエンドテスト
2. パフォーマンス最適化
3. UIデザイン調整

## 環境設定

### バックエンド環境変数
バックエンドのサーバー設定は環境変数を通じて簡単に変更できます。

```
# .env ファイル (または環境変数)
PORT=3001             # サーバーのポート番号
HOST=localhost        # サーバーのホスト名
```

これらの設定は `backend/src/config/server.ts` で管理され、フォールバック値が設定されています。

### フロントエンド環境変数
フロントエンドのAPI接続設定は環境変数を通じて変更できます。

```
# .env ファイル
VITE_API_BASE_URL=http://localhost:3001/api    # APIのベースURL
VITE_API_TIMEOUT=10000                          # APIリクエストのタイムアウト (ms)
```

これらの設定は `frontend/src/config/api.ts` で管理され、フォールバック値が設定されています。

### 設定の変更方法
1. バックエンドのポート/ホスト変更
   - `.env` ファイルを作成し、`PORT` や `HOST` を設定
   - または、環境変数として直接設定

2. フロントエンドのAPI接続先変更
   - `.env` ファイルを作成し、`VITE_API_BASE_URL` を設定
   - 本番環境や開発環境に応じて `.env.production` や `.env.development` を使い分け可能

3. 設定ファイルの利用
   - バックエンド: `serverConfig` オブジェクトから設定を取得
   - フロントエンド: `apiConfig` オブジェクトから設定を取得
