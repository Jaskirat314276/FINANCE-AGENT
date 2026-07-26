import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './error';

export interface AuthedRequest extends Request {
  userId: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

/** Verifies `Authorization: Bearer <access-token>` and attaches userId. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(ApiError.unauthorized());
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (payload.type !== 'access') throw new Error('wrong token type');
    (req as AuthedRequest).userId = payload.sub;
    next();
  } catch {
    next(ApiError.unauthorized('Session expired — please sign in again', 'TOKEN_EXPIRED'));
  }
}
