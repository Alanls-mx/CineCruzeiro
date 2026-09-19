import { redisClient } from '../../queue/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class RedisLock {
  /**
   * Acquires a distributed lock for a specific company and phone number.
   * Uses Redis SET NX with expiration.
   */
  static async acquireLock(
    companyId: string,
    phone: string,
    ttlSeconds = env.CONVERSATION_LOCK_TTL_SECONDS
  ): Promise<string | null> {
    const lockKey = `lock:conversation:${companyId}:${phone}`;
    const lockValue = uuidv4();

    try {
      const result = await redisClient.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
      if (result === 'OK') {
        return lockValue;
      }
      return null;
    } catch (error: any) {
      logger.error({ error: error.message, lockKey }, 'Failed to acquire conversation lock');
      return null;
    }
  }

  /**
   * Releases the lock atomically using a Lua script to ensure
   * only the holder of the lock can release it.
   */
  static async releaseLock(companyId: string, phone: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:conversation:${companyId}:${phone}`;

    // Atomic compare and del script
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await redisClient.eval(script, 1, lockKey, lockValue);
      return result === 1;
    } catch (error: any) {
      logger.error({ error: error.message, lockKey }, 'Failed to release conversation lock');
      return false;
    }
  }
}
