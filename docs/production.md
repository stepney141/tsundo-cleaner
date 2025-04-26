# 本番環境での実行方法とデプロイ方法

このドキュメントでは、`tsundo-cleaner` プロジェクトのフロントエンドとバックエンドを本番環境で実行し、デプロイする方法について説明します。

## Backend

### 1. ビルド

本番環境用にTypeScriptコードをJavaScriptにコンパイルします。

```bash
cd backend
npm run build
```

これにより、`backend/dist` ディレクトリに必要なJavaScriptファイルが生成されます。

### 2. 実行

コンパイルされたコードを実行します。

```bash
cd backend
npm start
```

**重要:**
*   実行前に、本番環境用の設定を含む `.env` ファイルを `backend` ディレクトリ直下に配置してください (`.env.example` を参考に作成)。
*   `NODE_ENV=production` 環境変数を設定して実行することを強く推奨します。これにより、Expressのエラーハンドリングやロギングなどが本番モードで動作します。

例:
```bash
cd backend
NODE_ENV=production npm start
```

### 3. デプロイ

デプロイ方法は、利用するインフラストラクチャによって異なります。

#### a) サーバー/VM (例: EC2, VPS)

1.  **コードの転送:** プロジェクト全体または `backend` ディレクトリをサーバーにコピーします (例: `scp`, `rsync`, Git clone)。
2.  **依存関係のインストール:** 本番に必要な依存関係のみをインストールします。
    ```bash
    cd backend
    npm install --production
    ```
3.  **ビルド:** サーバー上でビルドを実行します。
    ```bash
    npm run build
    ```
4.  **実行:** アプリケーションを起動します。
    ```bash
    NODE_ENV=production npm start
    ```
5.  **(推奨) プロセス管理:** `pm2` などのプロセス管理ツールを使用して、アプリケーションをデーモン化し、自動再起動などを設定します。
    ```bash
    # pm2をグローバルにインストール (初回のみ)
    npm install -g pm2

    # アプリケーションの起動と管理
    cd backend
    pm2 start dist/index.js --name tsundo-cleaner-backend --env production
    ```
    (`--env production` は `NODE_ENV=production` を設定する `pm2` の方法の一つです)

#### b) PaaS (例: Heroku, AWS Elastic Beanstalk, Google App Engine)

各プラットフォームのドキュメントに従ってデプロイします。通常、以下の点が自動化または設定されます。

*   Gitリポジトリをプラットフォームに接続します。
*   プラットフォームが `package.json` を検出し、`npm install --production` を実行します。
*   ビルドコマンド (`npm run build`) を設定または自動検出させます。
*   起動コマンド (`npm start`) が自動的に実行されます。
*   環境変数 (`NODE_ENV=production` やデータベース接続情報など) をプラットフォームの管理画面で設定します。

#### c) コンテナ (Docker)

1.  **Dockerfileの作成:** `backend` ディレクトリに `Dockerfile` を作成します。

    ```dockerfile
    # ベースイメージを選択
    FROM node:20-alpine

    # 作業ディレクトリを設定
    WORKDIR /usr/src/app

    # package.json と package-lock.json をコピー
    COPY backend/package*.json ./

    # 本番用の依存関係をインストール
    RUN npm install --production

    # アプリケーションのソースコードをコピー
    COPY backend/ ./

    # TypeScriptをビルド
    RUN npm run build

    # アプリケーションがリッスンするポートを公開
    EXPOSE 3000 # server.ts で設定されているポートに合わせてください

    # アプリケーションを実行
    CMD [ "node", "dist/index.js" ]

    # 環境変数を設定 (実行時に上書き可能)
    ENV NODE_ENV=production
    ```
    *(注意: 上記 Dockerfile はプロジェクトルートからビルドコンテキストが開始される想定です。backend ディレクトリ内でビルドする場合はパス調整が必要です)*

2.  **イメージのビルド:**
    ```bash
    docker build -t your-dockerhub-username/tsundo-cleaner-backend .
    ```
3.  **イメージのプッシュ:** (Docker Hub, ECR, GCRなど)
    ```bash
    docker push your-dockerhub-username/tsundo-cleaner-backend
    ```
4.  **デプロイ:** Kubernetes, Docker Swarm, AWS ECS, Google Cloud Runなどのコンテナオーケストレーションプラットフォームを使用してコンテナをデプロイします。環境変数はこれらのプラットフォームで設定します。

## Frontend

### 1. ビルド

本番環境用に最適化された静的ファイルを生成します。

```bash
cd frontend
npm run build
```

これにより、`frontend/dist` ディレクトリにHTML, CSS, JavaScriptなどの静的ファイルが生成されます。

### 2. デプロイ

生成された `frontend/dist` ディレクトリの内容を配信します。

#### a) 静的ホスティングサービス (例: Netlify, Vercel, AWS S3 + CloudFront, GitHub Pages)

*   **最も推奨される方法です。**
*   各サービスの指示に従い、`frontend/dist` ディレクトリをアップロードまたはGitリポジトリと連携させます。
*   多くのサービスでは、Gitリポジトリにプッシュすると自動的にビルド (`npm run build`) とデプロイが行われるように設定できます。
*   **SPA設定:** React Routerなどを使用しているため、任意のパスへの直接アクセス (`/search` など) で `index.html` が返されるように、サービスのルーティング設定 (リライト/リダイレクトルール) を構成する必要があります。

#### b) Webサーバー (例: Nginx, Apache)

1.  **ファイルの転送:** `frontend/dist` ディレクトリの内容をWebサーバーの適切な場所 (ドキュメントルートなど) にコピーします。
2.  **Webサーバーの設定:**
    *   **Nginx:**
        ```nginx
        server {
            listen 80;
            server_name yourdomain.com;

            root /path/to/frontend/dist;
            index index.html;

            location / {
                try_files $uri $uri/ /index.html; # SPAルーティング対応
            }

            # APIリクエストをバックエンドにプロキシする場合 (例)
            location /api {
                proxy_pass http://backend-server-address:3000; # バックエンドのアドレス
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }
        }
        ```
    *   **Apache:** `.htaccess` や `httpd.conf` で `mod_rewrite` を使用して同様の設定を行います。
        ```apache
        <IfModule mod_rewrite.c>
          RewriteEngine On
          RewriteBase /
          RewriteRule ^index\.html$ - [L]
          RewriteCond %{REQUEST_FILENAME} !-f
          RewriteCond %{REQUEST_FILENAME} !-d
          RewriteRule . /index.html [L]
        </IfModule>
        ```

#### c) Backendサーバーから配信

Node.js (Express) サーバーで静的ファイルを配信するように設定することも可能です。

```typescript
// backend/src/server.ts (または関連ファイル) に追加
import express from 'express';
import path from 'path';

// ... 他のミドルウェアやルート設定 ...

// フロントエンドの静的ファイルを提供
const frontendDistPath = path.join(__dirname, '../../frontend/dist'); // パスは環境に合わせて調整
app.use(express.static(frontendDistPath));

// APIルートより後に配置: SPAのルーティングに対応
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// ... サーバー起動処理 ...
```
この方法は、小規模なアプリケーションや特定の構成で便利ですが、通常は専用の静的ホスティングやWebサーバーを使用する方が効率的です。

## まとめ

*   **Backend:** ビルド (`npm run build`) → 実行 (`npm start` または `pm2 start`)。デプロイ先に応じて適切な手順を選択。
*   **Frontend:** ビルド (`npm run build`) → 生成された `dist` ディレクトリを静的ホスティングサービスやWebサーバーにデプロイ。SPAルーティングの設定を忘れずに。
