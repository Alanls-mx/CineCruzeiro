import { FastifyReply, FastifyRequest } from 'fastify';
import { WebhooksService } from './webhooks.service.js';
import { EvolutionWebhookPayload } from './webhooks.types.js';

export class WebhooksController {
  constructor(private readonly service = new WebhooksService()) {}

  handleEvolution = async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as EvolutionWebhookPayload;

    // Process asynchronously without holding the HTTP response
    const result = await this.service.handleEvolutionWebhook(payload);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };
}
