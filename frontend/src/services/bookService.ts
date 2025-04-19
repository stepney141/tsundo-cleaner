import apiClient from './api';
import { Book, BookType } from '../types/Book';

/**
 * 書籍関連のAPIサービス
 */
export const bookService = {
  /**
   * 今週のおすすめ本を取得
   */
  getWeeklyRecommendation: async (): Promise<Book> => {
    const response = await apiClient.get<Book>('/books/weekly');
    return response.data;
  },

  /**
   * 書籍タイプに基づいた全ての書籍を取得
   */
  getAllBooks: async (type: BookType = 'wish'): Promise<Book[]> => {
    const response = await apiClient.get<Book[]>('/books', {
      params: { type },
    });
    return response.data;
  },

  /**
   * キーワードで書籍を検索
   */
  searchBooks: async (query: string, type: BookType = 'wish'): Promise<Book[]> => {
    const response = await apiClient.get<Book[]>('/books/search', {
      params: { query, type },
    });
    return response.data;
  },

  /**
   * URLに基づいて特定の書籍を取得
   */
  getBookByUrl: async (url: string, type: BookType = 'wish'): Promise<Book> => {
    const response = await apiClient.get<Book>('/book', {
      params: { url, type },
    });
    return response.data;
  },

  /**
   * 特定の書籍に類似した書籍のリストを取得
   */
  getSimilarBooks: async (
    url: string,
    type: BookType = 'wish',
    limit: number = 5
  ): Promise<Book[]> => {
    const response = await apiClient.get<Book[]>('/books/similar', {
      params: { url, type, limit },
    });
    return response.data;
  },
};
