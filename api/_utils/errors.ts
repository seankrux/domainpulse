/**
 * Consistent error taxonomy for the DomainPulse API layer.
 *
 * Every error the API deliberately raises is an {@link AppError} tagged with an
 * {@link ErrorCategory}. The category maps deterministically to an HTTP status
 * (see CATEGORY_STATUS) and to a stable, machine-readable `code` in the JSON
 * body, so clients and dashboards can branch on the category instead of parsing
 * prose. Unknown/unexpected throwables are normalised to an `internal` error
 * whose raw message is logged but never returned to the caller (no leak of
 * stack traces or dependency internals).
 */

export enum ErrorCategory {
  Validation = 'validation',
  Auth = 'auth',
  Permission = 'permission',
  Dependency = 'dependency',
  Timeout = 'timeout',
  Conflict = 'conflict',
  Internal = 'internal',
}

/** Category → HTTP status. The single source of truth for error status codes. */
export const CATEGORY_STATUS: Record<ErrorCategory, number> = {
  [ErrorCategory.Validation]: 400,
  [ErrorCategory.Auth]: 401,
  [ErrorCategory.Permission]: 403,
  [ErrorCategory.Conflict]: 409,
  [ErrorCategory.Timeout]: 504,
  [ErrorCategory.Dependency]: 502,
  [ErrorCategory.Internal]: 500,
};

/** Safe, client-facing default messages per category (no internals leaked). */
const CATEGORY_DEFAULT_MESSAGE: Record<ErrorCategory, string> = {
  [ErrorCategory.Validation]: 'Invalid request.',
  [ErrorCategory.Auth]: 'Unauthorized.',
  [ErrorCategory.Permission]: 'Forbidden.',
  [ErrorCategory.Conflict]: 'Conflict.',
  [ErrorCategory.Timeout]: 'Upstream request timed out.',
  [ErrorCategory.Dependency]: 'Upstream dependency failed.',
  [ErrorCategory.Internal]: 'Internal server error.',
};

export interface ErrorResponseBody {
  error: string;
  code: ErrorCategory;
  requestId?: string;
}

export interface AppErrorOptions {
  /** Underlying cause, retained for logging only (never serialised to clients). */
  cause?: unknown;
  /** Extra structured context for logs (never serialised to clients). */
  meta?: Record<string, unknown>;
  /**
   * When true, `message` is considered safe to return to the client. Validation
   * messages ("Domain is required") are safe; internal messages are not.
   */
  expose?: boolean;
}

export class AppError extends Error {
  readonly category: ErrorCategory;
  readonly status: number;
  readonly expose: boolean;
  readonly meta?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(category: ErrorCategory, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.status = CATEGORY_STATUS[category];
    // Validation/auth/permission/conflict messages are safe to surface by
    // default; dependency/timeout/internal are hidden unless explicitly exposed.
    this.expose =
      options.expose ??
      (category === ErrorCategory.Validation ||
        category === ErrorCategory.Auth ||
        category === ErrorCategory.Permission ||
        category === ErrorCategory.Conflict);
    this.meta = options.meta;
    this.cause = options.cause;
  }
}

// Convenience constructors for the common categories.
export const validationError = (message: string, meta?: Record<string, unknown>) =>
  new AppError(ErrorCategory.Validation, message, { expose: true, meta });
export const authError = (message = 'Unauthorized', meta?: Record<string, unknown>) =>
  new AppError(ErrorCategory.Auth, message, { expose: true, meta });
export const permissionError = (message = 'Forbidden', meta?: Record<string, unknown>) =>
  new AppError(ErrorCategory.Permission, message, { expose: true, meta });
export const dependencyError = (message: string, options: AppErrorOptions = {}) =>
  new AppError(ErrorCategory.Dependency, message, options);
export const timeoutError = (message: string, options: AppErrorOptions = {}) =>
  new AppError(ErrorCategory.Timeout, message, options);
export const internalError = (message: string, options: AppErrorOptions = {}) =>
  new AppError(ErrorCategory.Internal, message, options);

/**
 * Best-effort classification of an arbitrary throwable into an {@link AppError}.
 * Already-typed AppErrors pass through unchanged. Timeout/abort and common
 * network failures are mapped to their categories; everything else becomes an
 * `internal` error with the original message retained for logging only.
 */
export function categorizeError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    const message = err.message.toLowerCase();

    if (name === 'aborterror' || name === 'timeouterror' || message.includes('timeout') || message.includes('timed out')) {
      return new AppError(ErrorCategory.Timeout, err.message, { cause: err });
    }
    // Node network failures (DNS, refused, reset, unreachable) are upstream deps.
    if (/(econnrefused|econnreset|enotfound|eai_again|ehostunreach|enetunreach|fetch failed|socket hang up)/.test(message)) {
      return new AppError(ErrorCategory.Dependency, err.message, { cause: err });
    }
    return new AppError(ErrorCategory.Internal, err.message, { cause: err });
  }

  return new AppError(ErrorCategory.Internal, typeof err === 'string' ? err : 'Unknown error', { cause: err });
}

/**
 * Map any throwable to a `{ status, body }` pair with a consistent client-facing
 * shape. Non-exposable messages are replaced with the category default so
 * internal detail never leaks; the real message stays on the AppError for the
 * caller to log.
 */
export function toErrorResponse(err: unknown, requestId?: string): { status: number; body: ErrorResponseBody; appError: AppError } {
  const appError = categorizeError(err);
  const clientMessage = appError.expose ? appError.message : CATEGORY_DEFAULT_MESSAGE[appError.category];
  const body: ErrorResponseBody = {
    error: clientMessage,
    code: appError.category,
    ...(requestId ? { requestId } : {}),
  };
  return { status: appError.status, body, appError };
}
