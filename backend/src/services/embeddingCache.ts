import { getDatabase, DatabaseType } from '../config/database';

/**
 * 埋め込みベクトルキャッシュを管理するモジュール
 * SQLiteデータベースを使用して永続的にキャッシュを保存します
 */

// 埋め込みキャッシュ専用データベース
const embeddingDb = getDatabase(DatabaseType.EMBEDDINGS);

// キャッシュテーブル初期化
export const initEmbeddingCache = async (): Promise<void> => {
  await embeddingDb.query(`
    CREATE TABLE IF NOT EXISTS embedding_cache (
      book_url TEXT PRIMARY KEY,
      embedding TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  
  // 古いキャッシュの削除（初期化時に実行）
  await removeExpiredCache();
};

// キャッシュに保存
export const saveEmbedding = async (
  bookUrl: string, 
  embedding: number[]
): Promise<void> => {
  const now = Date.now();
  
  await embeddingDb.query(
    `INSERT OR REPLACE INTO embedding_cache (book_url, embedding, created_at)
     VALUES (?, ?, ?)`,
    [bookUrl, JSON.stringify(embedding), now]
  );
};

// キャッシュから取得
export const getEmbedding = async (
  bookUrl: string
): Promise<number[] | null> => {
  const results = await embeddingDb.query<{embedding: string}>(
    `SELECT embedding FROM embedding_cache WHERE book_url = ?`,
    [bookUrl]
  );
  
  if (!results || results.length === 0) {
    return null;
  }
  
  return JSON.parse(results[0].embedding);
};

// 有効期限切れのキャッシュを削除（デフォルト：24時間）
export const removeExpiredCache = async (maxAgeMs: number = 86400000): Promise<void> => {
  const expiryTime = Date.now() - maxAgeMs;
  
  await embeddingDb.query(
    `DELETE FROM embedding_cache WHERE created_at < ?`,
    [expiryTime]
  );
};

// キャッシュサイズを確認
export const getCacheStats = async (): Promise<{count: number}> => {
  const results = await embeddingDb.query<{count: number}>(`SELECT COUNT(*) as count FROM embedding_cache`);
  return results[0];
};

// キャッシュをクリア
export const clearCache = async (): Promise<void> => {
  await embeddingDb.query(`DELETE FROM embedding_cache`);
};
