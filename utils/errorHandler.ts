import { Notifier } from '../components/Notifications';
import { logger } from './logger';

export class AppError extends Error {
  public readonly code?: string;
  public readonly cause?: unknown;

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.code = options?.code;
    this.cause = options?.cause;
  }
}

interface HandleErrorOptions {
  context?: string;
  userMessage?: string;
}

export function handleError(
  error: unknown,
  notifier?: Pick<Notifier, 'addToast'>,
  options?: HandleErrorOptions
) {
  const resolvedError =
    error instanceof AppError
      ? error
      : new AppError(options?.context || 'Unexpected error', { cause: error });

  const detail =
    resolvedError.cause instanceof Error
      ? resolvedError.cause
      : error instanceof Error
      ? error
      : resolvedError;

  if (options?.context) {
    logger.error(`[${options.context}]`, detail);
  } else {
    logger.error(detail);
  }

  if (notifier && options?.userMessage) {
    notifier.addToast(options.userMessage, 'error');
  }

  return resolvedError;
}
