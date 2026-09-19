import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.apikey',
      'req.headers.cookie',
      'apiKey',
      'api_key',
      'password',
      'secret',
      'token',
      'jwt',
      'creds',
      'session.creds',
      '*.password',
      '*.apiKey',
      '*.api_key',
      '*.token',
    ],
    censor: '[REDACTED_SENSITIVE]',
  },
});
