# tsundo-cleaner

書籍推薦Webアプリケーション - 読書メーターの積読・読みたい本データを活用した書籍リコメンデーションツール

## 機能

- 「今週はこの本を読もう」と書籍をサジェスト
- 関連する分野の文献を推薦
- 読書傾向（興味傾向）の可視化
- 「UTokyoにある本」「Sophiaにある本」「どちらにもない本」の優先順位で本をリコメンド

## 技術スタック

### フロントエンド
- Vite + React + TypeScript
- React Router
- Axios
- Recharts (データ可視化)
- styled-components (CSS-in-JS)

### バックエンド
- Node.js + Express + TypeScript
- SQLite3 (データベース)
- TF-IDF (テキスト類似度計算)

## 開発

### 前提条件
- Node.js (v18以上)
- npm (v8以上)

### インストールと開発サーバー起動

```bash
# フロントエンド
cd frontend
npm install
npm run dev

# バックエンド
cd backend
npm install
npm run dev
```

## リポジトリ構成

```
tsundo-cleaner/
├── frontend/          # フロントエンドアプリケーション (Vite + React + TypeScript)
├── backend/           # バックエンドAPI (Express + TypeScript)
├── docs/              # ドキュメント
└── README.md          # プロジェクト概要
