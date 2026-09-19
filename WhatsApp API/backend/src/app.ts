import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { v4 as uuidv4 } from 'uuid';
import { errorHandler } from './shared/middlewares/error-handler.js';
import { logger } from './config/logger.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { instancesRoutes } from './modules/whatsapp/instances/instances.routes.js';
import { webhooksRoutes } from './modules/whatsapp/webhooks/webhooks.routes.js';
import { conversationsRoutes } from './modules/whatsapp/conversations/conversations.routes.js';
import { settingsRoutes } from './modules/whatsapp/settings/settings.routes.js';
import { cinemaRoutes } from './modules/cinema/cinema.routes.js';
import { requireInternalService } from './shared/middlewares/internal-service-auth.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false, // We use custom Pino logger instance
    genReqId: (req) => (req.headers['x-correlation-id'] as string) || uuidv4(),
    trustProxy: true,
    bodyLimit: 25 * 1024 * 1024, // 25MB for base64 photo and attachment uploads
  });

  // Security Plugins
  app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  app.register(cors, {
    origin: (origin, cb) => {
      // In development or if CORS_ORIGIN is *, allow all origins
      if (!origin || env.NODE_ENV === 'development' || env.CORS_ORIGIN === '*') {
        return cb(null, true);
      }
      const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  app.register(sensible);

  // Every operational endpoint is private and can only be reached through the
  // authenticated Cine Cruzeiro admin gateway. Evolution webhooks use their
  // own signature validation in the webhook route.
  app.addHook('preHandler', async (request) => {
    if (request.url === '/health' || request.url.startsWith('/webhooks/evolution')) return;
    requireInternalService(request);
  });

  // Allow empty body on JSON requests (fixes FST_ERR_CTP_EMPTY_JSON_BODY)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const trimmed = (body as string)?.trim();
      const json = trimmed ? JSON.parse(trimmed) : {};
      done(null, json);
    } catch (err: any) {
      done(err, undefined);
    }
  });

  // Error Handler
  app.setErrorHandler(errorHandler);

  // Request correlation logging hook
  app.addHook('onRequest', async (request) => {
    logger.debug(
      {
        correlationId: request.id,
        method: request.method,
        url: request.url,
      },
      'Incoming HTTP request'
    );
  });

  // Healthcheck Route
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'lumixengine-whatsapp-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    };
  });

  // The companion is intentionally single-cinema. The browser never chooses a
  // tenant; the Cine Cruzeiro gateway is the only caller.
  app.get('/api/companies', async () => {
    const companies = await prisma.company.findMany({
      where: { slug: env.CINE_COMPANY_SLUG, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: companies,
    };
  });

  // WhatsApp Instances Routes
  app.register(instancesRoutes, { prefix: '/api/whatsapp' });

  // WhatsApp Conversations & Inbox Routes
  app.register(conversationsRoutes, { prefix: '/api/whatsapp' });

  // WhatsApp Settings Routes
  app.register(settingsRoutes, { prefix: '/api/whatsapp' });

  // Cinema Domain Routes (real movies, sessions, products, rooms)
  app.register(cinemaRoutes, { prefix: '/api' });

  // Public Evolution Webhooks
  app.register(webhooksRoutes, { prefix: '/webhooks' });

  return app;
}
