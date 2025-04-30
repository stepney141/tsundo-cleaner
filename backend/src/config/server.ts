/**
 * サーバー設定ファイル
 * ポート番号やその他のサーバー関連設定を管理します
 */

export interface ServerConfig {
  port: number;
  host: string;
  openaiApiKey: string; // OpenAI APIキーを追加
}

// デフォルトの設定
const defaultConfig: ServerConfig = {
  port: 3001,
  host: 'localhost',
  openaiApiKey: '' // デフォルト値を追加
};

// 環境変数から設定を読み込む
export const serverConfig: ServerConfig = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : defaultConfig.port,
  host: process.env.HOST || defaultConfig.host,
  // 環境変数 OPENAI_API_KEY から読み込む。未設定の場合は空文字。
  // 重要：本番環境では必ず設定してください。
  openaiApiKey: process.env.OPENAI_API_KEY || ''
};

// フルURLを生成するためのヘルパー関数
export const getServerUrl = (): string => {
  return `http://${serverConfig.host}:${serverConfig.port}`;
};

// APIベースURLを生成する関数
export const getApiBaseUrl = (): string => {
  return `${getServerUrl()}/api`;
};
