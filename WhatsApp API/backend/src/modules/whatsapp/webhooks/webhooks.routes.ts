import { FastifyInstance } from 'fastify';
import { WebhooksController } from './webhooks.controller.js';
import { requireEvolutionWebhookSignature } from '../../../shared/middlewares/internal-service-auth.js';

export async function webhooksRoutes(app: FastifyInstance) {
  const controller = new WebhooksController();

  // Public webhook route for Evolution API
  app.post('/evolution', { preHandler: requireEvolutionWebhookSignature }, controller.handleEvolution);
}
