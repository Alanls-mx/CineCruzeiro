import { FastifyInstance } from 'fastify';
import { InstancesController } from './instances.controller.js';
import { tenantMiddleware } from '../../../shared/middlewares/tenant-middleware.js';

export async function instancesRoutes(app: FastifyInstance) {
  const controller = new InstancesController();

  // Enforce tenant isolation on all instance routes
  app.addHook('preHandler', tenantMiddleware);

  app.post('/instances', controller.create);
  app.get('/instances', controller.list);
  app.get('/instances/:id', controller.getById);
  app.post('/instances/:id/connect', controller.connect);
  app.get('/instances/:id/qrcode', controller.getQrCode);
  app.get('/instances/:id/status', controller.getStatus);
  app.post('/instances/:id/disconnect', controller.disconnect);
  app.delete('/instances/:id', controller.delete);
}
