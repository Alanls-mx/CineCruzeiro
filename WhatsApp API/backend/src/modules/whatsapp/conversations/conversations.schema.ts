import { z } from 'zod';
import { ConversationMode, ConversationStatus, MessageType } from '@prisma/client';

export const listConversationsQuerySchema = z.object({
  status: z.nativeEnum(ConversationStatus).optional(),
  mode: z.nativeEnum(ConversationMode).optional(),
});

export const conversationIdParamSchema = z.object({
  id: z.string().uuid('Invalid conversation ID format'),
});

export const sendAgentMessageSchema = z
  .object({
    text: z.string().optional().default(''),
    type: z.nativeEnum(MessageType).default(MessageType.TEXT),
    mediaUrl: z.string().optional(),
    fileName: z.string().optional(),
  })
  .refine(
    (data) => (data.text && data.text.trim().length > 0) || (data.mediaUrl && data.mediaUrl.length > 0),
    { message: 'Mensagem deve conter texto ou anexo de mídia' }
  );

export const assignConversationSchema = z.object({
  userId: z.string().min(1, 'Selecione um usuário para atribuir o atendimento.').optional(),
  userName: z.string().trim().min(1).max(120).optional(),
});

export const publishStatusSchema = z.object({
  type: z.enum(['text', 'image', 'video']).default('text'),
  text: z.string().optional(),
  content: z.string().optional(),
  mediaUrl: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  font: z.number().int().min(0).max(5).optional(),
});

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type ConversationIdParam = z.infer<typeof conversationIdParamSchema>;
export type SendAgentMessageInput = z.infer<typeof sendAgentMessageSchema>;
export type AssignConversationInput = z.infer<typeof assignConversationSchema>;
export type PublishStatusInput = z.infer<typeof publishStatusSchema>;
