import { FastifyInstance } from 'fastify';
import { tenantMiddleware } from '../../shared/middlewares/tenant-middleware.js';
import { CommercialCatalogService } from './services/commercial-catalog.service.js';

export async function cinemaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantMiddleware);

  const catalogService = CommercialCatalogService.getInstance();

  // Read-only data projection. The primary cinema platform is the source of truth.
  app.get('/cinema/movies', async (_request, reply) => {
    const catalog = await catalogService.getCatalog();
    return reply.send({ success: true, data: catalog.movies || [] });
  });

  // List sessions
  app.get('/cinema/sessions', async (_request, reply) => {
    const catalog = await catalogService.getCatalog();
    return reply.send({ success: true, data: catalog.programming || [] });
  });

  // List bomboniere products
  app.get('/cinema/products', async (_request, reply) => {
    return reply.send({ success: true, data: await catalogService.getConcessions() });
  });

  // List cinema rooms
  app.get('/cinema/rooms', async (_request, reply) => {
    const catalog = await catalogService.getCatalog();
    const rooms = new Map();
    for (const session of catalog.programming || []) {
      if (session.room?.id) rooms.set(session.room.id, session.room);
    }
    return reply.send({ success: true, data: [...rooms.values()] });
  });
}
