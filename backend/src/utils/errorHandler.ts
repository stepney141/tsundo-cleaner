import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../../../shared/types/Book';

/**
 * アプリケーションエラーの基底クラス
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: any;

  constructor(message: string, code: string, status: number, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * リソース未検出エラー
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/**
 * データベースエラー
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

/**
 * データベース接続エラー（特別処理のため分離）
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string, details?: any) {
    super(`データベース接続エラー: ${message}`, {
      connectionError: true,
      ...details
    });
  }
}

/**
 * サーバー側の一時的なエラー
 */
export class TemporaryError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'TEMPORARY_ERROR', 503, details);
  }
}

/**
 * 集中型エラーハンドリングミドルウェア
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // エラー情報の構造化ログ
  const logData = {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    query: req.query,
    errorType: err.constructor.name,
    errorMessage: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };
  
  // 詳細なエラーログ
  console.error('[ERROR]', JSON.stringify(logData, null, 2));

  // データベース関連エラーの特別処理
  if (err instanceof DatabaseConnectionError) {
    console.error('[DATABASE_CONNECTION_ERROR] データベース接続に問題が発生しました');
  }

  // アプリケーション固有のエラーの場合
  if (err instanceof AppError) {
    // リクエストIDの生成（ログとレスポンスの紐付け用）
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    const errorResponse: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        requestId,
        // 開発環境でのみ詳細を返す
        ...(process.env.NODE_ENV === 'development' && { details: err.details })
      },
      status: err.status
    };
    
    // データベース接続エラーの場合は特別なヘッダーを設定
    if (err instanceof DatabaseConnectionError) {
      res.set('X-Database-Error', 'true');
    }
    
    return res.status(err.status).json(errorResponse);
  }

  // その他の未処理エラー
  const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '内部サーバーエラーが発生しました',
      requestId,
      // 開発環境でのみ詳細を返す
      ...(process.env.NODE_ENV === 'development' && { 
        details: {
          name: err.name,
          message: err.message,
          stack: err.stack
        } 
      })
    },
    status: 500
  };

  res.status(500).json(errorResponse);
}

/**
 * 存在しないルートのハンドラ
 */
export function notFoundHandler(req: Request, res: Response) {
  // リクエスト情報のログ
  console.log(`[404 NOT FOUND] Path: ${req.originalUrl}, Method: ${req.method}`);
  
  // リクエストIDの生成（ログとレスポンスの紐付け用）
  const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);

  const errorResponse: ErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: '要求されたリソースが見つかりません',
      requestId,
      // 開発環境でのみパス情報を返す
      ...(process.env.NODE_ENV === 'development' && { 
        path: req.originalUrl,
        method: req.method 
      })
    },
    status: 404
  };
  
  res.status(404).json(errorResponse);
}

/**
 * エラーをスローするヘルパー関数
 */

export function validateBookType(type: string): asserts type is 'wish' | 'stacked' {
  if (type !== 'wish' && type !== 'stacked') {
    throw new ValidationError(`無効な書籍タイプ: ${type}`);
  }
}

export function validateRequiredParam(value: any, paramName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${paramName}は必須パラメータです`);
  }
}

export function wrapAsync(fn: Function) {
  return function(req: Request, res: Response, next: NextFunction) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
