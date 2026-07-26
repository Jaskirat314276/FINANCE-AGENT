import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';

/** Throwable, HTTP-aware application error. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(msg: string, code = 'BAD_REQUEST') {
    return new ApiError(400, msg, code);
  }
  static unauthorized(msg = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, msg, code);
  }
  static forbidden(msg = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, msg, code);
  }
  static notFound(msg = 'Not found', code = 'NOT_FOUND') {
    return new ApiError(404, msg, code);
  }
  static conflict(msg: string, code = 'CONFLICT') {
    return new ApiError(409, msg, code);
  }
  static upstream(msg = 'Upstream data provider failed', code = 'UPSTREAM_ERROR') {
    return new ApiError(502, msg, code);
  }
}

/** Wrap async handlers so rejections reach the error middleware. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code ?? 'ERROR', message: err.message } });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Unhandled error', { message, stack: err instanceof Error ? err.stack : undefined });
  res.status(500).json({
    error: { code: 'INTERNAL', message: isProd ? 'Something went wrong' : message },
  });
}
