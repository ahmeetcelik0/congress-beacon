import {
  Global,
  Logger,
  Module,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// Projede Redis zaten BullMQ icin kullaniliyor (stale-visit-sweep,
// notification-scheduler), ama her ikisi de BullMQ'ya yalnizca bir baglanti
// NESNESI veriyor - paylasilan, enjekte edilebilir bir ioredis ornegi yoktu.
// Salon tespit algoritmasi v3'un sinyal calisma bellegi (bkz.
// BeaconSignalStore) dogrudan Redis'e erisiyor, bu yuzden tek bir paylasilan
// client burada tanimlandi. Yeni bir kutuphane eklenmedi; ioredis zaten
// dogrudan bagimlilikti.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const logger = new Logger('RedisClient');
        const client = new Redis(
          process.env.REDIS_URL ?? 'redis://localhost:6379',
          {
            // Redis kapaliyken komutlar KUYRUKLANMAMALI, aninda hata vermeli.
            // Aksi halde BeaconSignalStore'daki try/catch'ler ise yaramaz:
            // istek, Redis geri gelene kadar askida kalirdi. Salon karari
            // Redis olmadan da uretilebilmeli (yumusatmasiz), asla beklememeli.
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            // Arka planda tekrar baglanmayi surekli dene ki Redis geri
            // geldiginde yumusatma kendiliginden devreye girsin.
            retryStrategy: (times) => Math.min(times * 500, 5000),
          },
        );

        // ioredis her yeniden baglanma denemesinde 'error' yayar; bunu
        // yakalamazsak Node islemi cokerdi. Log spam'ini onlemek icin
        // dakikada bir uyari yeterli.
        let lastErrorLogAt = 0;
        client.on('error', (error: Error) => {
          const now = Date.now();
          if (now - lastErrorLogAt > 60_000) {
            lastErrorLogAt = now;
            logger.warn(
              `Redis baglantisi yok (${error.message}). Salon tespiti yumusatmasiz devam ediyor.`,
            );
          }
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy() {
    await this.client.quit().catch(() => {
      // baglanti zaten kopmussa sessizce gec
    });
  }
}
