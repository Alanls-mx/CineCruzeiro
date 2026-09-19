import { FastifyInstance } from 'fastify';
import { SettingsController } from './settings.controller.js';
import { tenantMiddleware } from '../../../shared/middlewares/tenant-middleware.js';

export async function settingsRoutes(app: FastifyInstance) {
  const controller = new SettingsController();

  app.addHook('preHandler', tenantMiddleware);

  app.get('/settings', controller.getSettings);
  app.put('/settings', controller.updateSettings);
}
