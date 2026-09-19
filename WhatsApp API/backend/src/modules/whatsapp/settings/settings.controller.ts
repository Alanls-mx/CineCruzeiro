import { FastifyReply, FastifyRequest } from 'fastify';
import { SettingsService } from './settings.service.js';
import { updateSettingsSchema } from './settings.schema.js';

export class SettingsController {
  constructor(private readonly service = new SettingsService()) {}

  getSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const settings = await this.service.getSettings(companyId);

    return reply.send({
      success: true,
      data: settings,
    });
  };

  updateSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const input = updateSettingsSchema.parse(request.body);

    const updated = await this.service.updateSettings(companyId, input);
    return reply.send({
      success: true,
      data: updated,
    });
  };
}
