import { FastifyInstance } from 'fastify';
import { tenantMiddleware } from '../../shared/middlewares/tenant-middleware.js';
import { CommercialCatalogService } from './services/commercial-catalog.service.js';

export async function cinemaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantMiddleware);

  const catalogService = CommercialCatalogService.getInstance();

  // Read-only data projection. The primary cinema platform is the source of truth.
  app.get('/cinema/movies', async (_request, reply) => {
    return reply.send({ success: true, data: await catalogService.getMovies() });
  });

  // List sessions
  app.get('/cinema/sessions', async (_request, reply) => {
    return reply.send({ success: true, data: await catalogService.getProgramming() });
  });

  // List bomboniere products
  app.get('/cinema/products', async (_request, reply) => {
    return reply.send({ success: true, data: await catalogService.getConcessions() });
  });

  // List cinema rooms
  app.get('/cinema/rooms', async (_request, reply) => {
    const rooms = new Map();
    for (const session of await catalogService.getProgramming()) {
      if (session.room?.id) rooms.set(session.room.id, session.room);
    }
    return reply.send({ success: true, data: [...rooms.values()] });
  });
}
