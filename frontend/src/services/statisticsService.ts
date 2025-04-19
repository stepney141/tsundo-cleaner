import apiClient from './api';
import {
  BookType,
  PublisherDistribution,
  AuthorDistribution,
  YearDistribution,
  LibraryDistribution,
} from '../types/Book';

/**
 * 統計情報関連のAPIサービス
 */
export const statisticsService = {
  /**
   * 出版社別の書籍数分布を取得
   */
  getPublisherDistribution: async (type: BookType = 'wish'): Promise<PublisherDistribution[]> => {
    const response = await apiClient.get<PublisherDistribution[]>('/stats/publishers', {
      params: { type },
    });
    return response.data;
  },

  /**
   * 著者別の書籍数分布を取得
   */
  getAuthorDistribution: async (type: BookType = 'wish'): Promise<AuthorDistribution[]> => {
    const response = await apiClient.get<AuthorDistribution[]>('/stats/authors', {
      params: { type },
    });
    return response.data;
  },

  /**
   * 出版年別の書籍数分布を取得
   */
  getYearDistribution: async (type: BookType = 'wish'): Promise<YearDistribution[]> => {
    const response = await apiClient.get<YearDistribution[]>('/stats/years', {
      params: { type },
    });
    return response.data;
  },

  /**
   * 図書館所蔵状況の分布を取得
   */
  getLibraryDistribution: async (type: BookType = 'wish'): Promise<LibraryDistribution[]> => {
    const response = await apiClient.get<LibraryDistribution[]>('/stats/libraries', {
      params: { type },
    });
    return response.data;
  },
};
