import axios from 'axios';

// APIクライアントのベースURLを設定
const API_BASE_URL = 'http://localhost:3001/api';

// Axiosインスタンスの作成
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
