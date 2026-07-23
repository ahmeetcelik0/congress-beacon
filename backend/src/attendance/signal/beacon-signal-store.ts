import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

export type BeaconSignalState = {
  emaValue: number;
  recentRssi: number[];
  updatedAt: string;
  // Bu EMA'nin en son GERCEKTEN gecerli (kabul edilmis) bir okumadan
  // guncellendigi an. `updatedAt`'ten farkli: o alan Hampel-reddi durumunda
  // da (pencere kaymasi icin) guncellenir, bu yuzden "EMA ne kadar taze"
  // sorusuna guvenilir cevap veremez. Grace-suresi hesaplamasi bunu kullanir.
  lastAcceptedAt: string;
};

export type OutlierCounters = {
  accepted: number;
  rejected: number;
};

// Kongre gunu sonunda kendiliginden temizlensin diye kisa omurlu tutuluyor.
const STATE_TTL_SECONDS = 8 * 60 * 60;

const stateKey = (userId: string, beaconId: string) =>
  `beacon-signal:${userId}:${beaconId}`;
const countersKey = (userId: string) => `beacon-signal-stats:${userId}`;

// Kullanici x beacon basina, salon karari icin gereken kucuk ve GECICI calisma
// bellegi. Kalici bir Prisma tablosu DEGIL: bu veri rapor/analitik verisi
// degil, yalnizca canli karar hesaplamasi icin tutulan ara durumdur.
//
// Redis arizasina dayaniklilik bu sinifin asil sorumlulugu: butun cagrilar
// try/catch ile sarili ve hata YUKARI FIRLATILMAZ. Redis yoksa okuma "gecmis
// yok" doner; algoritma o beacon icin pencereyi bos kabul eder, ham okumayi
// dogrudan kabul eder ve EMA'yi sifirdan baslatir. Yani sistem v2'nin "her
// olcum bagimsiz" davranisina duser - bozulmaz, yalnizca yumusatmasiz calisir.
// Bu anahtarin kaybolmasi kritik bir veri kaybi degildir.
@Injectable()
export class BeaconSignalStore {
  private readonly logger = new Logger(BeaconSignalStore.name);
  private lastWarnAt = 0;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Redis kapaliyken her istek icin log basmak gurultu yaratir; dakikada bir yeterli.
  private warnOnce(operation: string, error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnAt < 60_000) {
      return;
    }
    this.lastWarnAt = now;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Redis '${operation}' basarisiz (${message}). Sinyal yumusatma gecici olarak devre disi.`,
    );
  }

  async loadMany(
    userId: string,
    beaconIds: string[],
  ): Promise<Map<string, BeaconSignalState>> {
    const states = new Map<string, BeaconSignalState>();
    if (beaconIds.length === 0) {
      return states;
    }

    try {
      const raw = await this.redis.mget(
        ...beaconIds.map((beaconId) => stateKey(userId, beaconId)),
      );

      raw.forEach((value, index) => {
        if (!value) return;
        try {
          const parsed = JSON.parse(value) as BeaconSignalState;
          // Bozuk/eski sekilli kayitlari sessizce yok say - "gecmis yok" gibi
          // davranmak, hatali bir EMA ile karar uretmekten iyidir.
          if (
            typeof parsed?.emaValue === 'number' &&
            Array.isArray(parsed?.recentRssi)
          ) {
            states.set(beaconIds[index], parsed);
          }
        } catch {
          // tek bir bozuk kayit digerlerini engellemesin
        }
      });
    } catch (error) {
      this.warnOnce('loadMany', error);
    }

    return states;
  }

  async saveMany(
    userId: string,
    states: Map<string, BeaconSignalState>,
  ): Promise<void> {
    if (states.size === 0) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();
      for (const [beaconId, state] of states) {
        pipeline.set(
          stateKey(userId, beaconId),
          JSON.stringify(state),
          'EX',
          STATE_TTL_SECONDS,
        );
      }
      await pipeline.exec();
    } catch (error) {
      // Yazma kaybi telafi edilebilir: bir sonraki snapshot yeniden dener.
      this.warnOnce('saveMany', error);
    }
  }

  // Panelde "reddedilen/anormal okuma orani" gosterebilmek icin gereken tek
  // veri kaynagi. Ham gozleme yeni kolon eklemek kapsam disi oldugundan
  // (talimat §2/§3.5) sayaclar da ayni gecici Redis alaninda tutuluyor.
  async bumpCounters(
    userId: string,
    accepted: number,
    rejected: number,
  ): Promise<void> {
    if (accepted === 0 && rejected === 0) {
      return;
    }

    try {
      const key = countersKey(userId);
      const pipeline = this.redis.pipeline();
      if (accepted > 0) pipeline.hincrby(key, 'accepted', accepted);
      if (rejected > 0) pipeline.hincrby(key, 'rejected', rejected);
      pipeline.expire(key, STATE_TTL_SECONDS);
      await pipeline.exec();
    } catch (error) {
      this.warnOnce('bumpCounters', error);
    }
  }

  // Takip Sagligi sayfasi tum katilimcilari birden listeliyor, bu yuzden
  // kullanici basina ayri istek yerine tek pipeline.
  async readCountersMany(
    userIds: string[],
  ): Promise<Map<string, OutlierCounters>> {
    const counters = new Map<string, OutlierCounters>();
    if (userIds.length === 0) {
      return counters;
    }

    try {
      const pipeline = this.redis.pipeline();
      for (const userId of userIds) {
        pipeline.hgetall(countersKey(userId));
      }
      const results = await pipeline.exec();
      if (!results) {
        return counters;
      }

      results.forEach(([error, value], index) => {
        if (error || !value) return;
        const hash = value as Record<string, string>;
        const accepted = Number(hash.accepted ?? 0);
        const rejected = Number(hash.rejected ?? 0);
        if (accepted + rejected > 0) {
          counters.set(userIds[index], { accepted, rejected });
        }
      });
    } catch (error) {
      this.warnOnce('readCountersMany', error);
    }

    return counters;
  }
}
