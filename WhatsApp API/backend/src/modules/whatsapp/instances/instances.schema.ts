import { z } from 'zod';
import { WhatsAppInstanceStatus, WhatsAppProviderType } from '@prisma/client';

export const createInstanceSchema = z.object({
  instanceName: z
    .string()
    .min(3, 'Instance name must have at least 3 characters')
    .max(50, 'Instance name cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Instance name must be lowercase alphanumeric with hyphens (e.g. cine-estacao-whatsapp)'),
  provider: z.nativeEnum(WhatsAppProviderType).default(WhatsAppProviderType.EVOLUTION),
});

export const instanceIdParamSchema = z.object({
  id: z.string().uuid('Invalid instance ID format'),
});

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type InstanceIdParam = z.infer<typeof instanceIdParamSchema>;
