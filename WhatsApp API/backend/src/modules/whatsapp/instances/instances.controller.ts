import { FastifyReply, FastifyRequest } from 'fastify';
import { InstancesService } from './instances.service.js';
import { createInstanceSchema, instanceIdParamSchema } from './instances.schema.js';

export class InstancesController {
  constructor(private readonly service = new InstancesService()) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const input = createInstanceSchema.parse(request.body);

    const result = await this.service.createInstance(companyId, input);
    return reply.status(201).send({
      success: true,
      data: result,
    });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const instances = await this.service.listInstances(companyId);

    return reply.send({
      success: true,
      data: instances,
    });
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = instanceIdParamSchema.parse(request.params);

    const instance = await this.service.getInstance(companyId, id);
    return reply.send({
      success: true,
      data: instance,
    });
  };

  connect = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = instanceIdParamSchema.parse(request.params);

    const result = await this.service.connectInstance(companyId, id);
    return reply.send({
      success: true,
      data: result,
    });
  };

  getQrCode = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = instanceIdParamSchema.parse(request.params);

    const result = await this.service.getQrCode(companyId, id);
    return reply.send({
      success: true,
      data: result,
    });
  };

  getStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = instanceIdParamSchema.parse(request.params);

    const result = await this.service.getLiveStatus(companyId, id);
    return reply.send({
      success: true,
      data: result,
    });
  };

  disconnect = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = instanceIdParamSchema.parse(request.params);

    const result = await this.service.disconnectInstance(companyId, id);
    return reply.send({
      success: true,
      data: result,
    });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = instanceIdParamSchema.parse(request.params);

    const result = await this.service.deleteInstance(companyId, id);
    return reply.send({
      success: true,
      data: result,
    });
  };
}
