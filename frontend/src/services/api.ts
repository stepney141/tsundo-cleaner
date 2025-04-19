import axios from 'axios';
import { apiConfig } from '../config/api';

// Axiosインスタンスの作成
const apiClient = axios.create({
  baseURL: apiConfig.baseUrl,
  timeout: apiConfig.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
