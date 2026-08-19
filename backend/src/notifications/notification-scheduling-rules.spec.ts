import {
  buildReminderNotification,
  buildStartNotification,
  exceedsHourlyCap,
  HOURLY_NOTIFICATION_CAP,
  minuteBucket,
  minuteBucketToRange,
  shouldScheduleJob,
  type SessionNotificationInfo,
} from './notification-scheduling-rules';

describe('shouldScheduleJob', () => {
  it('gelecekteki bir ates alma zamani icin true doner', () => {
    expect(shouldScheduleJob(2000, 1000)).toBe(true);
  });

  it('gecmisteki bir ates alma zamani icin false doner (Faz 4b toplu ice aktarma korumasi)', () => {
    expect(shouldScheduleJob(500, 1000)).toBe(false);
  });

  it('tam simdiki an icin false doner (kesin gelecek gerekir)', () => {
    expect(shouldScheduleJob(1000, 1000)).toBe(false);
  });
});

describe('minuteBucket / minuteBucketToRange', () => {
  it('ayni dakika icindeki iki zaman damgasi ayni kovaya duser', () => {
    const t1 = Date.UTC(2026, 7, 11, 10, 15, 5);
    const t2 = Date.UTC(2026, 7, 11, 10, 15, 55);
    expect(minuteBucket(t1)).toBe(minuteBucket(t2));
  });

  it('farkli dakikadaki zaman damgalari farkli kovaya duser', () => {
    const t1 = Date.UTC(2026, 7, 11, 10, 15, 59);
    const t2 = Date.UTC(2026, 7, 11, 10, 16, 0);
    expect(minuteBucket(t1)).not.toBe(minuteBucket(t2));
  });

  it('kova araligi tam bir dakikayi kapsar', () => {
    const bucket = minuteBucket(Date.UTC(2026, 7, 11, 10, 15, 30));
    const { startMs, endMs } = minuteBucketToRange(bucket);
    expect(endMs - startMs).toBe(60000);
    expect(startMs).toBeLessThanOrEqual(Date.UTC(2026, 7, 11, 10, 15, 30));
    expect(endMs).toBeGreaterThan(Date.UTC(2026, 7, 11, 10, 15, 30));
  });
});

function makeSession(
  overrides: Partial<SessionNotificationInfo> = {},
): SessionNotificationInfo {
  return {
    sessionId: 's1',
    sessionTitle: 'Kardiyolojide Güncel Yaklaşımlar',
    hallName: 'Ana Salon A',
    keywords: null,
    ...overrides,
  };
}

describe('buildStartNotification', () => {
  it('tek oturumda baslik oturum adi, govde salon bilgisidir', () => {
    const result = buildStartNotification([makeSession()]);
    expect(result.title).toBe('Kardiyolojide Güncel Yaklaşımlar');
    expect(result.body).toBe("Ana Salon A'da başladı");
  });

  it('tek oturumda anahtar kelime varsa govdeye eklenir', () => {
    const result = buildStartNotification([
      makeSession({ keywords: 'kardiyoloji, görüntüleme' }),
    ]);
    expect(result.body).toBe(
      "Ana Salon A'da başladı — kardiyoloji, görüntüleme",
    );
  });

  it('bos/bosluk anahtar kelime govdeye tire birakmaz', () => {
    const result = buildStartNotification([makeSession({ keywords: '   ' })]);
    expect(result.body).toBe("Ana Salon A'da başladı");
  });

  it('birden fazla oturum tek birlestirilmis bildirimde toplanir', () => {
    const result = buildStartNotification([
      makeSession({ sessionId: 's1', hallName: 'Salon A' }),
      makeSession({ sessionId: 's2', hallName: 'Salon B' }),
      makeSession({ sessionId: 's3', hallName: 'Salon C' }),
    ]);
    expect(result.title).toBe('3 oturum başladı');
    expect(result.body).toBe('Salon A, Salon B, Salon C');
  });
});

describe('buildReminderNotification', () => {
  it('tek oturumda mevcut (Faz 9 oncesi) format korunur', () => {
    const result = buildReminderNotification([
      makeSession({ sessionTitle: 'Aritmi Yönetimi' }),
    ]);
    expect(result.title).toBe('Oturum yakında başlıyor');
    expect(result.body).toBe('Aritmi Yönetimi 10 dakika içinde başlıyor.');
  });

  it('birden fazla oturum tek birlestirilmis hatirlatmada toplanir', () => {
    const result = buildReminderNotification([
      makeSession({ sessionId: 's1', hallName: 'Salon A' }),
      makeSession({ sessionId: 's2', hallName: 'Salon B' }),
    ]);
    expect(result.title).toBe('2 oturum yakında başlıyor');
    expect(result.body).toBe('Salon A, Salon B');
  });
});

describe('exceedsHourlyCap', () => {
  it('sinirin altinda false doner', () => {
    expect(exceedsHourlyCap(HOURLY_NOTIFICATION_CAP - 1)).toBe(false);
  });

  it('sinira ulasinca true doner', () => {
    expect(exceedsHourlyCap(HOURLY_NOTIFICATION_CAP)).toBe(true);
  });

  it('siniri asinca true doner', () => {
    expect(exceedsHourlyCap(HOURLY_NOTIFICATION_CAP + 5)).toBe(true);
  });
});
