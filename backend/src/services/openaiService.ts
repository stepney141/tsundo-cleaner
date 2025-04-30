import { OpenAI } from 'openai';
import { serverConfig } from '../config/server';

/**
 * OpenAI APIを利用するサービス
 */

// APIクライアントの初期化
const openai = new OpenAI({
  apiKey: serverConfig.openaiApiKey,
});

/**
 * テキストから埋め込みベクトルを取得
 * @param text 埋め込みベクトルを取得するテキスト
 * @returns 埋め込みベクトル（数値の配列）
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
  if (!serverConfig.openaiApiKey) {
    throw new Error('OpenAI API キーが設定されていません。環境変数 OPENAI_API_KEY を設定してください。');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI Embeddings APIエラー:', error);
    throw error;
  }
};

/**
 * コサイン類似度を計算
 * @param vec1 ベクトル1
 * @param vec2 ベクトル2
 * @returns コサイン類似度（-1から1の範囲、1が最も類似）
 */
export const calculateCosineSimilarity = (vec1: number[], vec2: number[]): number => {
  if (vec1.length !== vec2.length) {
    throw new Error('ベクトルの次元が一致しません');
  }
  
  // ドット積（内積）の計算
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  
  // ベクトルの大きさを計算
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  // 0除算防止
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  // コサイン類似度を返す
  return dotProduct / (magnitude1 * magnitude2);
};
