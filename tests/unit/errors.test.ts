import { describe, it, expect } from 'vitest';
import {
  AppError,
  ErrorCategory,
  CATEGORY_STATUS,
  categorizeError,
  toErrorResponse,
  validationError,
  dependencyError,
  timeoutError,
  internalError,
} from '../../api/_utils/errors';

describe('error taxonomy → status mapping', () => {
  it('maps every category to the expected HTTP status', () => {
    expect(CATEGORY_STATUS[ErrorCategory.Validation]).toBe(400);
    expect(CATEGORY_STATUS[ErrorCategory.Auth]).toBe(401);
    expect(CATEGORY_STATUS[ErrorCategory.Permission]).toBe(403);
    expect(CATEGORY_STATUS[ErrorCategory.Conflict]).toBe(409);
    expect(CATEGORY_STATUS[ErrorCategory.Timeout]).toBe(504);
    expect(CATEGORY_STATUS[ErrorCategory.Dependency]).toBe(502);
    expect(CATEGORY_STATUS[ErrorCategory.Internal]).toBe(500);
  });

  it('AppError derives status from its category', () => {
    expect(validationError('x').status).toBe(400);
    expect(dependencyError('x').status).toBe(502);
    expect(timeoutError('x').status).toBe(504);
    expect(internalError('x').status).toBe(500);
  });
});

describe('categorizeError()', () => {
  it('passes AppError through unchanged', () => {
    const e = validationError('Domain is required');
    expect(categorizeError(e)).toBe(e);
  });

  it('classifies timeout/abort errors as Timeout', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    expect(categorizeError(abort).category).toBe(ErrorCategory.Timeout);
    expect(categorizeError(new Error('request timed out')).category).toBe(ErrorCategory.Timeout);
  });

  it('classifies network failures as Dependency', () => {
    expect(categorizeError(new Error('getaddrinfo ENOTFOUND example.com')).category).toBe(ErrorCategory.Dependency);
    expect(categorizeError(new Error('connect ECONNREFUSED 1.2.3.4:443')).category).toBe(ErrorCategory.Dependency);
    expect(categorizeError(new Error('fetch failed')).category).toBe(ErrorCategory.Dependency);
  });

  it('falls back to Internal for unknown errors and non-Error throwables (negative paths)', () => {
    expect(categorizeError(new Error('something odd')).category).toBe(ErrorCategory.Internal);
    expect(categorizeError('a raw string').category).toBe(ErrorCategory.Internal);
    expect(categorizeError(undefined).category).toBe(ErrorCategory.Internal);
    expect(categorizeError({ weird: true }).category).toBe(ErrorCategory.Internal);
  });
});

describe('toErrorResponse()', () => {
  it('exposes safe validation messages verbatim', () => {
    const { status, body } = toErrorResponse(validationError('Domain is required'), 'req-1');
    expect(status).toBe(400);
    expect(body.error).toBe('Domain is required');
    expect(body.code).toBe(ErrorCategory.Validation);
    expect(body.requestId).toBe('req-1');
  });

  it('never leaks internal error detail to the client', () => {
    const { status, body } = toErrorResponse(new Error('DB password=hunter2 leaked'), 'req-2');
    expect(status).toBe(500);
    expect(body.code).toBe(ErrorCategory.Internal);
    expect(body.error).toBe('Internal server error.');
    expect(body.error).not.toContain('hunter2');
  });

  it('hides dependency detail but preserves the raw message on the AppError for logging', () => {
    const { body, appError } = toErrorResponse(dependencyError('upstream 503 from registrar'));
    expect(body.error).toBe('Upstream dependency failed.');
    expect(appError.message).toBe('upstream 503 from registrar');
  });

  it('omits requestId when not provided', () => {
    const { body } = toErrorResponse(validationError('bad'));
    expect(body.requestId).toBeUndefined();
  });

  it('respects explicit expose flag on AppError', () => {
    const e = new AppError(ErrorCategory.Dependency, 'safe to show', { expose: true });
    expect(toErrorResponse(e).body.error).toBe('safe to show');
  });
});
