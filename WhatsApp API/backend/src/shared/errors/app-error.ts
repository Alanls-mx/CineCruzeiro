export class AppError extends Error {
  public readonly isAppError = true;
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = 'APP_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access to resource', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class WhatsAppProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, 'WHATSAPP_PROVIDER_ERROR', details);
  }
}

export class EvolutionConnectionError extends AppError {
  constructor(message = 'Evolution API connection failed', details?: unknown) {
    super(message, 503, 'EVOLUTION_CONNECTION_ERROR', details);
  }
}

export class ConversationLockedError extends AppError {
  constructor(message = 'Conversation is currently locked by another process', details?: unknown) {
    super(message, 423, 'CONVERSATION_LOCKED', details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}
