import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const correlationId = request.headers['x-correlation-id'] || request.id;

  // Zod validation errors
  if (error instanceof ZodError) {
    logger.warn(
      {
        correlationId,
        url: request.url,
        issues: error.issues,
      },
      'Schema validation error'
    );

    return reply.status(400).send({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      correlationId,
    });
  }

  // Domain AppError
  const isAppError =
    error instanceof AppError ||
    (error as any).isAppError ||
    (typeof (error as any).statusCode === 'number' && typeof (error as any).code === 'string');

  if (isAppError) {
    const appErr = error as any;
    const statusCode = appErr.statusCode || 400;
    const code = appErr.code || 'APP_ERROR';

    logger.warn(
      {
        correlationId,
        url: request.url,
        code,
        message: appErr.message,
        details: appErr.details,
      },
      'Application domain error'
    );

    return reply.status(statusCode).send({
      success: false,
      code,
      message: appErr.message,
      details: appErr.details,
      correlationId,
    });
  }

  // Fastify Schema Validation Error
  if (error.validation) {
    logger.warn(
      {
        correlationId,
        url: request.url,
        validation: error.validation,
      },
      'Fastify validation error'
    );

    return reply.status(400).send({
      success: false,
      code: 'REQUEST_VALIDATION_ERROR',
      message: error.message,
      correlationId,
    });
  }

  // Unexpected Internal Server Error
  logger.error(
    {
      correlationId,
      url: request.url,
      method: request.method,
      error: {
        message: error.message,
        stack: env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    },
    'Unhandled server error'
  );

  return reply.status(500).send({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'development' ? error.message || 'An unexpected internal server error occurred' : 'An unexpected internal server error occurred',
    correlationId,
  });
}
