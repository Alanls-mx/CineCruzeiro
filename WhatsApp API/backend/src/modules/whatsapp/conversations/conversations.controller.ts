import { FastifyReply, FastifyRequest } from 'fastify';
import { ConversationsService } from './conversations.service.js';
import {
  conversationIdParamSchema,
  assignConversationSchema,
  listConversationsQuerySchema,
  publishStatusSchema,
  sendAgentMessageSchema,
} from './conversations.schema.js';
import { SSEService } from '../realtime/sse.service.js';
import { v4 as uuidv4 } from 'uuid';

export class ConversationsController {
  constructor(private readonly service = new ConversationsService()) {}

  private internalActor(request: FastifyRequest) {
    const userId = String(request.headers['x-lumix-admin-user'] || '').trim();
    const name = String(request.headers['x-lumix-admin-user-name'] || '').trim();
    return userId ? { userId, userName: name || 'Atendente do Cine Cruzeiro' } : undefined;
  }

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const query = listConversationsQuerySchema.parse(request.query);

    const conversations = await this.service.list(companyId, query);
    return reply.send({
      success: true,
      data: conversations,
    });
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);

    const conversation = await this.service.getById(companyId, id);
    return reply.send({
      success: true,
      data: conversation,
    });
  };

  getMessages = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);

    const messages = await this.service.getMessages(companyId, id);
    return reply.send({
      success: true,
      data: messages,
    });
  };

  sendMessage = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);
    const input = sendAgentMessageSchema.parse(request.body);

    const message = await this.service.sendAgentMessage(companyId, id, input, this.internalActor(request));
    return reply.status(201).send({
      success: true,
      data: message,
    });
  };

  takeover = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);

    const result = await this.service.takeover(companyId, id, this.internalActor(request));
    return reply.send({
      success: true,
      data: result,
    });
  };

  release = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);

    const result = await this.service.release(companyId, id);
    return reply.send({
      success: true,
      data: result,
    });
  };

  assign = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);
    const input = assignConversationSchema.parse(request.body);
    const result = await this.service.assign(companyId, id, input);
    return reply.send({ success: true, data: result });
  };

  close = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);

    const result = await this.service.close(companyId, id);
    return reply.send({
      success: true,
      data: result,
    });
  };

  streamEvents = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const clientId = uuidv4();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ clientId, companyId })}\n\n`);

    SSEService.addClient(clientId, companyId, reply);
  };

  publishStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const input = publishStatusSchema.parse(request.body);

    const result = await this.service.publishStatus(companyId, input);
    return reply.status(201).send({
      success: true,
      data: result,
    });
  };

  syncProfilePicture = async (request: FastifyRequest, reply: FastifyReply) => {
    const companyId = request.company!.id;
    const { id } = conversationIdParamSchema.parse(request.params);

    const picUrl = await this.service.syncProfilePicture(companyId, id);
    return reply.send({
      success: true,
      data: { profilePictureUrl: picUrl },
    });
  };
}
