/**
 * Request-scoped observability for Vercel API handlers.
 *
 * `withObservability(operation, handler)` wraps an existing handler so that,
 * without changing any of its response bodies or status codes, every request:
 *   - gets a correlation id (reused from an inbound `x-request-id` header or
 *     freshly generated) echoed back in the `x-request-id` response header;
 *   - emits a structured `request.start` / `request.finish` log with method,
 *     path, resulting status and duration;
 *   - has any *uncaught* throwable funnelled through the error taxonomy into a
 *     consistent JSON error response (previously an unhandled throw produced an
 *     opaque platform 500 with no log line).
 *
 * The wrapper is deliberately additive: handlers that already send their own
 * response (the normal path) are untouched; the centralized error path only
 * fires when a handler throws and hasn't yet sent headers.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createLogger } from './logger.js';
import { toErrorResponse } from './errors.js';

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

function resolveRequestId(req: VercelRequest): string {
  const header = req.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  if (candidate && typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 200) {
    return candidate;
  }
  return crypto.randomUUID();
}

export function withObservability(operation: string, handler: ApiHandler): ApiHandler {
  return async function observedHandler(req: VercelRequest, res: VercelResponse) {
    const requestId = resolveRequestId(req);
    const logger = createLogger({ operation, requestId });
    const startedAt = Date.now();

    try {
      res.setHeader('x-request-id', requestId);
    } catch {
      // Header may already be committed in exotic cases; ignore.
    }

    logger.info('request.start', { method: req.method, path: req.url });

    try {
      await handler(req, res);
      logger.info('request.finish', {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const { status, body, appError } = toErrorResponse(err, requestId);
      logger.error('request.error', {
        statusCode: status,
        durationMs: Date.now() - startedAt,
        category: appError.category,
        // The raw (possibly sensitive) message stays in logs only, redacted.
        errorName: appError.name,
        errorMessage: appError.message,
        meta: appError.meta,
      });
      if (!res.headersSent) {
        res.status(status).json(body);
      }
    }
  };
}
