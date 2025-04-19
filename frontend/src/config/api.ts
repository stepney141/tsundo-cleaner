/**
 * API設定ファイル
 * APIのエンドポイントURLなどの設定を管理します
 */

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

// デフォルトの設定
const defaultConfig: ApiConfig = {
  baseUrl: 'http://localhost:3001/api',
  timeout: 10000 // 10秒
};

// 環境変数から設定を読み込む
export const apiConfig: ApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || defaultConfig.baseUrl,
  timeout: import.meta.env.VITE_API_TIMEOUT 
    ? parseInt(import.meta.env.VITE_API_TIMEOUT, 10) 
    : defaultConfig.timeout
};

// APIのフルURLを生成するヘルパー関数
export const getApiUrl = (endpoint: string): string => {
  // エンドポイントが既に/で始まっている場合は重複を避ける
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${apiConfig.baseUrl}${formattedEndpoint}`;
};
