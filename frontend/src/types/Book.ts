/**
 * データベース内の書籍データモデル（DB形式）
 * データベースでは真偽値が'Yes'/'No'として格納されています
 */
export interface BookDB {
  bookmeter_url: string;       // 読書メーターURL (プライマリキー)
  isbn_or_asin: string;        // ISBN/ASIN
  book_title: string;          // 書籍タイトル
  author: string;              // 著者
  publisher: string;           // 出版社
  published_date: string;      // 出版日
  exist_in_Sophia: string;     // 上智大学にあるか ('Yes'/'No')
  exist_in_UTokyo: string;     // 東京大学にあるか ('Yes'/'No')
  sophia_opac?: string;        // 上智OPACリンク
  utokyo_opac?: string;        // 東大OPACリンク
  sophia_mathlib_opac?: string; // 上智数学図書館OPACリンク
  description?: string;        // 書籍の説明
}

/**
 * アプリケーション内の書籍データモデル（アプリ形式）
 * アプリケーション内では真偽値がbooleanとして扱われます
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
  bookType?: BookType;         // 書籍タイプ（'stacked'または'wish'）
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
