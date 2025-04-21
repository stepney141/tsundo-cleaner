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
 * 集中型エラーハンドリングミドルウェア
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 開発環境用のエラーログ
  console.error('[ERROR]', err);

  // アプリケーション固有のエラーの場合
  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        // 開発環境でのみ詳細を返す
        ...(process.env.NODE_ENV === 'development' && { details: err.details })
      },
      status: err.status
    };
    
    return res.status(err.status).json(errorResponse);
  }

  // その他の未処理エラー
  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '内部サーバーエラーが発生しました',
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
  const errorResponse: ErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: '要求されたリソースが見つかりません'
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
