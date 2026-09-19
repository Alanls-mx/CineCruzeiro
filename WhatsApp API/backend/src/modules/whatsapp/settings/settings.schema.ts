import { z } from 'zod';

export const updateSettingsSchema = z.object({
  autoReplyEnabled: z.boolean().optional(),
  welcomeMessage: z.string().min(5).optional(),
  fallbackMessage: z.string().min(5).optional(),
  outOfHoursMessage: z.string().min(5).optional(),
  workingHours: z.record(z.any()).optional(),
  autoCloseMinutes: z.number().min(5).max(1440).optional(),
  debounceDelayMs: z.number().min(0).max(10000).optional(),
  humanSupportEnabled: z.boolean().optional(),
  showProgramming: z.boolean().optional(),
  showTickets: z.boolean().optional(),
  showSnackBar: z.boolean().optional(),
  maxFallbackCount: z.number().min(1).max(10).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
