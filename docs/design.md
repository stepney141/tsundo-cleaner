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
│   ├── RecommendationService
│   ├── SimilarityService
│   └── StatisticsService
└── Data Access Layer
    └── SQLite Database
```

### データモデル

```typescript
// 書籍データモデル
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
```

## API設計

| エンドポイント | メソッド | 説明 | パラメータ | レスポンス |
|--------------|--------|------|-----------|----------|
| /api/books/weekly | GET | 今週のおすすめ本を取得 | なし | 書籍オブジェクト |
| /api/books/similar | GET | 類似書籍を取得 | bookUrl（クエリパラメータ） | 書籍オブジェクトの配列 |
| /api/books/search | GET | 書籍検索 | query（クエリパラメータ） | 書籍オブジェクトの配列 |
| /api/stats/distribution | GET | ジャンル等の分布統計を取得 | なし | 統計データ |

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
- SimilarBooksSection: 類似書籍表示セクション
- BookSearch: 書籍検索フォーム
- ReadingTrendChart: 読書傾向グラフ

## バックエンド設計

### ディレクトリ構造
```
backend/
├── src/
│   ├── index.ts            # エントリーポイント
│   ├── config/             # 設定
│   ├── controllers/        # APIコントローラー
│   ├── models/             # データモデル
│   ├── routes/             # APIルート定義
│   ├── services/           # ビジネスロジック
│   │   ├── recommendationService.ts
│   │   ├── similarityService.ts
│   │   └── statisticsService.ts
│   └── utils/              # ユーティリティ関数
├── package.json
└── tsconfig.json
```

### 推薦アルゴリズム
1. 優先順位に基づく推薦
   - UTokyoにある本を優先
   - 次にSophiaにある本
   - 最後にどちらにもない本
   - ランダム性も考慮して毎週異なる本を推薦

2. 類似度計算（TF-IDF）
   - 書籍の説明文（description）を使用
   - 形態素解析による日本語テキスト処理
   - TF-IDFベクトルによる類似度スコア計算

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
1. ジャンル分布グラフ実装
2. 時系列変化グラフ実装

### フェーズ5: 統合テストと調整
1. エンドツーエンドテスト
2. パフォーマンス最適化
3. UIデザイン調整
