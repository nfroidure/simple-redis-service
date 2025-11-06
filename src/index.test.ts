import { describe, beforeEach, test, jest, expect } from '@jest/globals';
import { constant, Knifecycle } from 'knifecycle';
import initRedisService from './index.js';
import type { RedisService, RedisConfig } from './index.js';
import type { LogService } from 'common-services';

describe('Redis service', () => {
  let $: Knifecycle;
  const log = jest.fn<LogService>();

  beforeEach(() => {
    log.mockReset();
    $ = new Knifecycle();
    $.register(constant('ENV', {}));
    $.register(constant('log', log));
    $.register(
      constant('REDIS', {
        host: 'localhost',
        port: 6379,
      } as RedisConfig),
    );
    $.register(initRedisService);
  });

  test('should init well', async () => {
    const { redis } = (await $.run(['log', 'redis'])) as {
      redis: RedisService;
    };

    expect(typeof redis.get).toEqual('function');
    expect(typeof redis.set).toEqual('function');

    await redis.set('testkey', 'testvalue');
    expect(await redis.get('testkey')).toEqual('testvalue');
    await redis.del('testkey');
    expect(await redis.get('testkey')).toBeNull();

    await $.destroy();

    expect(log.mock.calls).toMatchInlineSnapshot(`
[
  [
    "warning",
    "🏧 - Redis service initialized!",
  ],
  [
    "warning",
    "🔌 - Quitting Redis server...",
  ],
]
`);
  });
});
