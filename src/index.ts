import { printStackTrace, YError } from 'yerror';
import { autoProvider, location, type Provider } from 'knifecycle';
import { Redis, type RedisOptions } from 'ioredis';
import { type LogService } from 'common-services';

/* Architecture Note #1: Redis Service

The `redis` service wraps ioredis to make it work
 directly with Knifecycle based frameworks like
 Whook.
*/

export type RedisEnv<
  T extends string = typeof DEFAULT_REDIS_PASSWORD_ENV_NAME,
> = Partial<Record<T | 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_USERNAME', string>>;
export type RedisService = InstanceType<typeof Redis>;
export interface RedisConfig<
  T extends string = typeof DEFAULT_REDIS_PASSWORD_ENV_NAME,
> {
  REDIS?: RedisOptions;
  REDIS_PASSWORD_ENV_NAME?: T;
}
export type RedisDependencies<
  T extends string = typeof DEFAULT_REDIS_PASSWORD_ENV_NAME,
> = RedisConfig<T> & {
  ENV: RedisEnv<T>;
  log: LogService;
};

export const DEFAULT_REDIS_OPTIONS: RedisOptions = {};

export const DEFAULT_REDIS_PASSWORD_ENV_NAME = 'REDIS_PASSWORD';

// Docs: https://github.com/luin/ioredis/blob/master/API.md

/**
 * Instantiate the Redis service
 * @name initRedisService
 * @function
 * @param  {Object}     services
 * The services to inject
 * @param  {Object}   [services.ENV]
 * An environment object
 * @param  {Function}   services.REDIS
 * The configuration object as given to `node-redis`
 * @param  {Function}   [services.REDIS_PASSWORD_ENV_NAME]
 * The environment variable name in which to pick-up the
 *  Redis password
 * @param  {Function}   services.log
 * A logging function
 * @return {Promise<RedisService>}
 * A promise of the Redis service
 * @example
 * import initRedisService from 'simple-redis-service';
 *
 * const redis = await initRedisService({
 *   REDIS: {
 *     host: 'localhost',
 *     port: 6379,
 *   },
 *   ENV: process.env,
 *   log: console.log.bind(console),
 * });
 *
 * const value = await redis.get('my_key');
 */
async function initRedis<
  T extends string = typeof DEFAULT_REDIS_PASSWORD_ENV_NAME,
>({
  REDIS = DEFAULT_REDIS_OPTIONS,
  REDIS_PASSWORD_ENV_NAME = DEFAULT_REDIS_PASSWORD_ENV_NAME as T,
  ENV,
  log,
}: RedisDependencies<T>): Promise<Provider<RedisService>> {
  const host = ENV.REDIS_HOST || REDIS.host;
  const port = ENV.REDIS_PORT ? parseInt(ENV.REDIS_PORT, 10) : REDIS.port;
  const username = ENV.REDIS_USERNAME;
  const password = ENV[REDIS_PASSWORD_ENV_NAME];

  if (!host) {
    throw new YError('E_MISSING_ENV_VAR', ['REDIS_HOST']);
  }
  if (typeof port === 'undefined') {
    if (!ENV.REDIS_PORT) {
      throw new YError('E_MISSING_ENV_VAR', ['REDIS_PORT']);
    }
  } else if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new YError('E_INVALID_REDIS_PORT', [port]);
  }

  const client = new Redis({
    ...REDIS,
    host,
    port,
    ...(password ? { password } : {}),
    ...(username ? { username } : {}),
  });

  log('warning', `🏧 - Redis service initialized!`);

  const fatalErrorPromise = new Promise<void>((_, reject) => {
    client.once('error', (err) => {
      const wrappedError = YError.wrap(err, 'E_REDIS');

      log(
        'error-stack',
        `💥 - Redis service error:`,
        printStackTrace(wrappedError),
      );
      reject(wrappedError);
    });
  });

  return {
    service: client,
    fatalErrorPromise,
    async dispose(): Promise<void> {
      log('warning', '🔌 - Quitting Redis server...');
      client.quit();
    },
  };
}

export default location(autoProvider(initRedis), import.meta.url);
