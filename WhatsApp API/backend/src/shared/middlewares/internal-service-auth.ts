import crypto from 'crypto';
import { FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

function fixedLengthEquals(received: string | undefined, expected: string): boolean {
  if (!received || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export function requireInternalService(request: FastifyRequest): void {
  const token = request.headers['x-lumix-internal-token'];
  const received = Array.isArray(token) ? token[0] : token;
  if (!fixedLengthEquals(received, env.INTERNAL_API_TOKEN)) {
    throw new UnauthorizedError('Internal LumixEngine authentication is required');
  }
}

export function requireEvolutionWebhookSignature(request: FastifyRequest): void {
  const signature = request.headers['x-lumix-webhook-secret'];
  const received = Array.isArray(signature) ? signature[0] : signature;
  if (!fixedLengthEquals(received, env.EVOLUTION_WEBHOOK_SECRET)) {
    throw new ForbiddenError('Invalid Evolution webhook signature');
  }
}
