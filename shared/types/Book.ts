/**
 * 書籍データモデル
 * フロントエンドとバックエンドで共有される型定義
 */
export interface Book {
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

/**
 * 書籍タイプ
 * wish: 読みたい本リスト
 * stacked: 積読リスト
 */
export type BookType = 'wish' | 'stacked';

/**
 * 統計データの型定義
 */
export interface PublisherDistribution {
  publisher: string;
  count: number;
}

export interface AuthorDistribution {
  author: string;
  count: number;
}

export interface YearDistribution {
  year: string;
  count: number;
}

export interface LibraryDistribution {
  library: string;
  count: number;
}

/**
 * ページネーションパラメータ
 */
export interface PaginationParams {
  page: number;      // ページ番号（1から始まる）
  limit: number;     // 1ページあたりの項目数
}

/**
 * ページネーション結果
 */
export interface PaginatedResult<T> {
  items: T[];            // 結果アイテム
  totalItems: number;    // 全アイテム数
  totalPages: number;    // 全ページ数
  currentPage: number;   // 現在のページ
  hasNextPage: boolean;  // 次のページがあるか
  hasPrevPage: boolean;  // 前のページがあるか
}

/**
 * エラーレスポンス
 */
export interface ErrorResponse {
  error: {
    code: string;      // エラーコード
    message: string;   // ユーザー向けメッセージ
    details?: any;     // 追加詳細情報（開発環境でのみ使用）
  };
  status: number;      // HTTPステータスコード
}
