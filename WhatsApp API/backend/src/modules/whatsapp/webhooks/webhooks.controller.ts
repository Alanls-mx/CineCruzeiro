import { FastifyReply, FastifyRequest } from 'fastify';
import { WebhooksService } from './webhooks.service.js';
import { EvolutionWebhookPayload } from './webhooks.types.js';
import { logger } from '../../../config/logger.js';

export class WebhooksController {
  constructor(private readonly service = new WebhooksService()) {}

  handleEvolution = (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as EvolutionWebhookPayload;

    // Evolution retries slow webhooks aggressively. Acknowledge receipt first,
    // then persist and enqueue the event without keeping its HTTP request open.
    void this.service.handleEvolutionWebhook(payload).catch((error) => {
      logger.error(
        { err: error, instance: payload?.instance, event: payload?.event },
        'Evolution webhook processing failed after acknowledgement'
      );
    });

    return reply.status(202).send({
      success: true,
      data: { received: true, processing: true },
    });
  };
}
