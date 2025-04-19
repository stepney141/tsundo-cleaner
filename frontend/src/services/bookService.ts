import apiClient from './api';
import { Book, BookType } from '../types/Book';

/**
 * 書籍関連のAPIサービス
 */
export const bookService = {
  // 推薦関連の機能

  /**
   * 今週のおすすめ本を取得
   */
  getWeeklyRecommendation: async (): Promise<Book> => {
    const response = await apiClient.get<Book>('/books/weekly');
    return response.data;
  },

  /**
   * ジャンル（著者/出版社）に基づくおすすめ本を取得
   */
  getRecommendationByGenre: async (
    genreType: 'author' | 'publisher',
    genreValue: string,
    type: BookType = 'wish'
  ): Promise<Book> => {
    const response = await apiClient.get<Book>('/books/recommend-by-genre', {
      params: { genreType, genreValue, type },
    });
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
