export type ErrorCode = 
  | 'INIT_ERROR'
  | 'CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'RUNTIME_ERROR'
  | 'PLUGIN_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  source?: string;
}

export class ErrorBuilder {
  private error: AppError;

  constructor(code: ErrorCode, message: string) {
    this.error = {
      code,
      message,
      timestamp: new Date(),
    };
  }

  withDetails(details: Record<string, unknown>): ErrorBuilder {
    this.error.details = details;
    return this;
  }

  withSource(source: string): ErrorBuilder {
    this.error.source = source;
    return this;
  }

  build(): AppError {
    return { ...this.error };
  }
}

export function createError(code: ErrorCode, message: string): AppError {
  return new ErrorBuilder(code, message).build();
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value
  );
}

export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export const ErrorCodes = {
  INIT_ERROR: 'INIT_ERROR' as ErrorCode,
  CONFIG_ERROR: 'CONFIG_ERROR' as ErrorCode,
  NETWORK_ERROR: 'NETWORK_ERROR' as ErrorCode,
  RUNTIME_ERROR: 'RUNTIME_ERROR' as ErrorCode,
  PLUGIN_ERROR: 'PLUGIN_ERROR' as ErrorCode,
  VALIDATION_ERROR: 'VALIDATION_ERROR' as ErrorCode,
  NOT_FOUND: 'NOT_FOUND' as ErrorCode,
  UNKNOWN: 'UNKNOWN' as ErrorCode,
};
