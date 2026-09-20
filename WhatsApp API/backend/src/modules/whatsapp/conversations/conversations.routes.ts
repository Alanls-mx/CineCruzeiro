import { FastifyInstance } from 'fastify';
import { ConversationsController } from './conversations.controller.js';
import { tenantMiddleware } from '../../../shared/middlewares/tenant-middleware.js';

export async function conversationsRoutes(app: FastifyInstance) {
  const controller = new ConversationsController();

  app.addHook('preHandler', tenantMiddleware);

  app.get('/conversations', controller.list);
  app.get('/conversations/:id', controller.getById);
  app.get('/conversations/:id/messages', controller.getMessages);
  app.post('/conversations/:id/messages', controller.sendMessage);
  app.post('/conversations/:id/takeover', controller.takeover);
  app.post('/conversations/:id/release', controller.release);
  app.post('/conversations/:id/assign', controller.assign);
  app.post('/conversations/:id/close', controller.close);
  app.post('/status', controller.publishStatus);
  app.post('/contacts/:id/sync-profile-picture', controller.syncProfilePicture);
  app.get('/events', controller.streamEvents);
}
