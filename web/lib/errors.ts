export type ApiErrorCode =
  'INVALID_PARAMS' | 'UNAUTHORIZED' | 'UNSUPPORTED_LANGUAGE' | 'NOT_FOUND' | 'INTERNAL'

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AppError'
  }
}

export class InvalidParamsError extends AppError {
  constructor(message: string) {
    super('INVALID_PARAMS', 400, message)
    this.name = 'InvalidParamsError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required') {
    super('UNAUTHORIZED', 401, message)
    this.name = 'UnauthorizedError'
  }
}

export class UnsupportedLanguageError extends AppError {
  constructor(language: string) {
    super('UNSUPPORTED_LANGUAGE', 400, `Language '${language}' is not supported`)
    this.name = 'UnsupportedLanguageError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', 404, message)
    this.name = 'NotFoundError'
  }
}

export class RepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepositoryError'
  }
}
