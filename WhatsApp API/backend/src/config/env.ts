import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const isTestEnvironment = process.env.NODE_ENV === 'test';
const testOnlySecret = 'test_only_whatsapp_secret_4f43b74a5e8b9c10d2f6a7b8';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('127.0.0.1'),
  APP_URL: z.string().default('http://localhost:3333'),
  EVOLUTION_WEBHOOK_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),

  // Evolution API
  EVOLUTION_API_URL: z.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default(''),
  EVOLUTION_WEBHOOK_SECRET: z.string().default(isTestEnvironment ? testOnlySecret : ''),

  // Security
  JWT_SECRET: z.string().default(''),
  INTERNAL_API_TOKEN: z.string().default(isTestEnvironment ? testOnlySecret : ''),
  CINE_COMPANY_SLUG: z.string().default('cine-cruzeiro'),
  CORS_ORIGIN: z.string().default('https://lumixengine.com'),

  // WhatsApp Defaults
  DEFAULT_DEBOUNCE_DELAY_MS: z.coerce.number().default(3000),
  CONVERSATION_LOCK_TTL_SECONDS: z.coerce.number().default(15),
  CHECKOUT_BASE_URL: z.string().url().default('https://lumixengine.com/projects/cinecruzeiro'),

  // Commercial Catalog (Cine Cruzeiro)
  COMMERCIAL_CATALOG_URL: z.string().default('https://lumixengine.com/projects/cinecruzeiro/api/commercial/catalog'),
  COMMERCIAL_CATALOG_TOKEN: z.string().default(''),
  COMMERCIAL_CATALOG_CACHE_TTL_SECONDS: z.coerce.number().default(60),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;

if (env.NODE_ENV !== 'test') {
  const requiredSecrets = [
    ['EVOLUTION_API_KEY', env.EVOLUTION_API_KEY],
    ['EVOLUTION_WEBHOOK_SECRET', env.EVOLUTION_WEBHOOK_SECRET],
    ['JWT_SECRET', env.JWT_SECRET],
    ['INTERNAL_API_TOKEN', env.INTERNAL_API_TOKEN],
    ['COMMERCIAL_CATALOG_TOKEN', env.COMMERCIAL_CATALOG_TOKEN],
  ];
  const invalid = requiredSecrets.find(([, value]) => String(value).length < 32);
  if (invalid) throw new Error(`${invalid[0]} must be configured with a production secret`);
}
