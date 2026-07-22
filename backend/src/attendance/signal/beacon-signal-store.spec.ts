import { BeaconSignalStore } from './beacon-signal-store';

// Redis kapaliyken ioredis'in davranisi: enableOfflineQueue:false oldugu icin
// komutlar kuyruklanmaz, dogrudan hata firlatir.
function createFailingRedis() {
  const fail = () => Promise.reject(new Error("Stream isn't writeable"));
  return {
    mget: fail,
    pipeline: () => {
      throw new Error("Stream isn't writeable");
    },
  };
}

function createWorkingRedis(values: Record<string, string>) {
  const commands: unknown[][] = [];
  const pipeline = {
    set: (...args: unknown[]) => {
      commands.push(['set', ...args]);
      return pipeline;
    },
    hincrby: (...args: unknown[]) => {
      commands.push(['hincrby', ...args]);
      return pipeline;
    },
    expire: (...args: unknown[]) => {
      commands.push(['expire', ...args]);
      return pipeline;
    },
    hgetall: (...args: unknown[]) => {
      commands.push(['hgetall', ...args]);
      return pipeline;
    },
    exec: () => Promise.resolve([]),
  };

  return {
    redis: {
      mget: (...keys: string[]) =>
        Promise.resolve(keys.map((key) => values[key] ?? null)),
      pipeline: () => pipeline,
    },
    commands,
  };
}

function buildStore(redis: unknown) {
  return new BeaconSignalStore(redis as never);
}

describe('BeaconSignalStore - Redis erisilemedigi durum', () => {
  // Bu davranis, salon tespitinin Redis'e BAGIMLI olmamasini garanti eder:
  // hata yukari firlatilirsa POST /observations/batch 500 dondururdu.
  it('loadMany hata firlatmaz, bos gecmis doner', async () => {
    const store = buildStore(createFailingRedis());
    await expect(store.loadMany('user-1', ['beacon-1'])).resolves.toEqual(
      new Map(),
    );
  });

  it('saveMany hata firlatmaz', async () => {
    const store = buildStore(createFailingRedis());
    await expect(
      store.saveMany(
        'user-1',
        new Map([
          ['beacon-1', { emaValue: -70, recentRssi: [-70], updatedAt: 'now' }],
        ]),
      ),
    ).resolves.toBeUndefined();
  });

  it('bumpCounters hata firlatmaz', async () => {
    const store = buildStore(createFailingRedis());
    await expect(store.bumpCounters('user-1', 3, 1)).resolves.toBeUndefined();
  });

  it('readCountersMany hata firlatmaz, bos sonuc doner', async () => {
    const store = buildStore(createFailingRedis());
    await expect(store.readCountersMany(['user-1'])).resolves.toEqual(
      new Map(),
    );
  });
});

describe('BeaconSignalStore - normal calisma', () => {
  it('kayitli durumu okur ve ayristirir', async () => {
    const { redis } = createWorkingRedis({
      'beacon-signal:user-1:beacon-1': JSON.stringify({
        emaValue: -68.5,
        recentRssi: [-70, -68],
        updatedAt: '2026-07-22T10:00:00.000Z',
      }),
    });
    const store = buildStore(redis);

    const states = await store.loadMany('user-1', ['beacon-1', 'beacon-2']);

    expect(states.size).toBe(1);
    expect(states.get('beacon-1')?.emaValue).toBe(-68.5);
    expect(states.get('beacon-2')).toBeUndefined();
  });

  it('bozuk JSON kaydini yok sayar, digerlerini etkilemez', async () => {
    const { redis } = createWorkingRedis({
      'beacon-signal:user-1:beacon-1': '{bozuk',
      'beacon-signal:user-1:beacon-2': JSON.stringify({
        emaValue: -60,
        recentRssi: [-60],
        updatedAt: '2026-07-22T10:00:00.000Z',
      }),
    });
    const store = buildStore(redis);

    const states = await store.loadMany('user-1', ['beacon-1', 'beacon-2']);

    expect(states.has('beacon-1')).toBe(false);
    expect(states.get('beacon-2')?.emaValue).toBe(-60);
  });

  it('eksik alanli kaydi yok sayar', async () => {
    const { redis } = createWorkingRedis({
      'beacon-signal:user-1:beacon-1': JSON.stringify({ emaValue: -60 }),
    });
    const store = buildStore(redis);

    await expect(store.loadMany('user-1', ['beacon-1'])).resolves.toEqual(
      new Map(),
    );
  });

  it('durumu TTL ile yazar', async () => {
    const { redis, commands } = createWorkingRedis({});
    const store = buildStore(redis);

    await store.saveMany(
      'user-1',
      new Map([
        ['beacon-1', { emaValue: -70, recentRssi: [-70], updatedAt: 'now' }],
      ]),
    );

    expect(commands).toHaveLength(1);
    expect(commands[0][0]).toBe('set');
    expect(commands[0][1]).toBe('beacon-signal:user-1:beacon-1');
    expect(commands[0][3]).toBe('EX');
    expect(commands[0][4]).toBe(8 * 60 * 60);
  });

  it('sifir sayacta Redis e hic dokunmaz', async () => {
    const { redis, commands } = createWorkingRedis({});
    const store = buildStore(redis);

    await store.bumpCounters('user-1', 0, 0);

    expect(commands).toHaveLength(0);
  });
});
