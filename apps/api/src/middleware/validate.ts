import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

/**
 * Validates and REPLACES req[target] with the parsed (coerced, defaulted)
 * value. Throws ZodError → 422 via the error middleware.
 */
export function validate<S extends ZodTypeAny>(schema: S, target: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[target]);
    (req as Request & { [k: string]: unknown })[target === 'query' ? 'validatedQuery' : target] =
      parsed;
    next();
  };
}

/** Typed accessor for query validated via `validate(schema, 'query')`. */
export function getValidatedQuery<S extends ZodTypeAny>(req: Request): z.infer<S> {
  return (req as Request & { validatedQuery?: z.infer<S> }).validatedQuery as z.infer<S>;
}
