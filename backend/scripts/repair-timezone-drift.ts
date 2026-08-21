// Faz 12: ONARIM betigi - `diagnose-timezone-drift.ts`nin gosterdigi
// kaymayi Session/Presentation kayitlarinda duzeltir. VARSAYILAN
// `--dry-run` - hicbir satir DEGISMEZ, yalnizca ne degisecegi yazdirilir.
// Gercek yazma icin acikca `--apply` verilmelidir.
//
// NestJS uygulama baglaminda (`NestFactory.createApplicationContext`)
// calisir - `PrismaService` yerine dogrudan `PrismaClient` KULLANILMIYOR,
// cunku her Session guncellemesinden SONRA `NotificationSchedulerService.
// scheduleForSession` cagrilmali (bkz. asagisi, "bildirim yeniden
// planlamasi"). Bu servis BullMQ kuyrugunu/Redis baglantisini kendi
// `onModuleInit`inde kuruyor - tam DI grafigi olmadan (yalnizca
// `new NotificationSchedulerService(...)`) dogru calismaz.
//
// Kullanim (once derle):
//   npm run build
//
// Onizleme (hicbir sey degismez):
//   node dist/scripts/repair-timezone-drift.js --offset-minutes=180
//
// Belirli bir kongreyle sinirla:
//   node dist/scripts/repair-timezone-drift.js --offset-minutes=180 --congress-id=<uuid>
//
// Tarih araligiyla sinirla (Session.startTime bu aralikta olanlar):
//   node dist/scripts/repair-timezone-drift.js --offset-minutes=180 --from=2026-09-01 --to=2026-09-30
//
// Gercekten yaz (onizlemeyi gorup ONAYLADIKTAN SONRA):
//   node dist/scripts/repair-timezone-drift.js --offset-minutes=180 --apply
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationSchedulerService } from '../src/notifications/notification-scheduler.service';

type Args = {
  apply: boolean;
  offsetMinutes: number;
  congressId: string | null;
  from: Date | null;
  to: Date | null;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string): string | null => {
    const prefix = `--${name}=`;
    const found = argv.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const offsetRaw = get('offset-minutes');
  if (!offsetRaw) {
    console.error(
      'HATA: --offset-minutes zorunlu (kaç dakika GERİ alınacağı - ör. ' +
        '3 saatlik kayma için --offset-minutes=180). Sabit bir değer ' +
        'koda gömülmedi, önce diagnose-timezone-drift.ts çıktısına göre ' +
        'karar verilmeli.',
    );
    process.exit(1);
  }
  const offsetMinutes = Number(offsetRaw);
  if (!Number.isFinite(offsetMinutes)) {
    console.error(`HATA: --offset-minutes geçersiz sayı: ${offsetRaw}`);
    process.exit(1);
  }

  const fromRaw = get('from');
  const toRaw = get('to');

  return {
    apply: argv.includes('--apply'),
    offsetMinutes,
    congressId: get('congress-id'),
    from: fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : null,
    to: toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : null,
  };
}

function shifted(date: Date, offsetMinutes: number): Date {
  return new Date(date.getTime() - offsetMinutes * 60000);
}

async function main() {
  const args = parseArgs();
  console.log(
    `Mod: ${args.apply ? 'APPLY (gerçekten yazacak)' : 'DRY-RUN (hiçbir şey değişmeyecek)'}`,
  );
  console.log(`Kayma miktarı: ${args.offsetMinutes} dakika (geri alınacak)`);
  if (args.congressId) console.log(`Kongre filtresi: ${args.congressId}`);
  if (args.from) console.log(`Başlangıç filtresi: ${args.from.toISOString()}`);
  if (args.to) console.log(`Bitiş filtresi: ${args.to.toISOString()}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const notificationScheduler = app.get(NotificationSchedulerService);

  try {
    const sessionWhere: Record<string, unknown> = {};
    if (args.congressId) sessionWhere.congressId = args.congressId;
    if (args.from || args.to) {
      sessionWhere.startTime = {
        ...(args.from ? { gte: args.from } : {}),
        ...(args.to ? { lte: args.to } : {}),
      };
    }

    const sessions = await prisma.session.findMany({
      where: sessionWhere,
      select: { id: true, congressId: true, title: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    console.log(`\n${sessions.length} Session kaydı etkilenecek.`);
    console.log('İlk 10 kayıt (eski -> yeni):');
    for (const session of sessions.slice(0, 10)) {
      const newStart = shifted(session.startTime, args.offsetMinutes);
      const newEnd = shifted(session.endTime, args.offsetMinutes);
      console.log(
        `  [${session.title.slice(0, 40)}] ` +
          `${session.startTime.toISOString()} -> ${newStart.toISOString()}  |  ` +
          `${session.endTime.toISOString()} -> ${newEnd.toISOString()}`,
      );
    }

    const presentationWhere: Record<string, unknown> = {
      startTime: { not: null },
    };
    if (args.congressId || args.from || args.to) {
      presentationWhere.session = sessionWhere;
    }
    const presentations = await prisma.presentation.findMany({
      where: presentationWhere,
      select: { id: true, title: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    console.log(`\n${presentations.length} Presentation kaydı etkilenecek.`);
    console.log('İlk 10 kayıt (eski -> yeni):');
    for (const presentation of presentations.slice(0, 10)) {
      const newStart = presentation.startTime
        ? shifted(presentation.startTime, args.offsetMinutes)
        : null;
      const newEnd = presentation.endTime
        ? shifted(presentation.endTime, args.offsetMinutes)
        : null;
      console.log(
        `  [${presentation.title.slice(0, 40)}] ` +
          `${presentation.startTime?.toISOString()} -> ${newStart?.toISOString()}  |  ` +
          `${presentation.endTime?.toISOString() ?? 'null'} -> ${newEnd?.toISOString() ?? 'null'}`,
      );
    }

    if (!args.apply) {
      console.log(
        '\nDRY-RUN tamamlandı - hiçbir kayıt değişmedi. Gerçekten ' +
          'yazmak için aynı komuta --apply ekleyin.',
      );
      return;
    }

    console.log('\nYazılıyor...');
    let updatedSessions = 0;
    for (const session of sessions) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          startTime: shifted(session.startTime, args.offsetMinutes),
          endTime: shifted(session.endTime, args.offsetMinutes),
        },
      });
      updatedSessions++;

      // Faz 12 §11: oturum saati degistigi icin Redis kuyrugundaki
      // bildirim isleri ESKI (yanlis) zamanlamayi tasimaya devam eder -
      // her guncellemeden SONRA yeniden planlanmali. `scheduleForSession`
      // once eski job'lari iptal edip yeniden kuruyor (bkz.
      // notification-scheduler.service.ts); `shouldScheduleJob` GECMISTE
      // kalan oturumlar icin zaten is KURMUYOR, bu yuzden duzeltme
      // sonrasi bile gecmiste kalan oturumlar icin sessizce hicbir sey
      // yapilmaz - bu DOGRU davranistir.
      const updated = await prisma.session.findUniqueOrThrow({
        where: { id: session.id },
        select: { id: true, congressId: true, title: true, startTime: true },
      });
      await notificationScheduler.scheduleForSession(updated);
    }

    let updatedPresentations = 0;
    for (const presentation of presentations) {
      await prisma.presentation.update({
        where: { id: presentation.id },
        data: {
          startTime: presentation.startTime
            ? shifted(presentation.startTime, args.offsetMinutes)
            : null,
          endTime: presentation.endTime
            ? shifted(presentation.endTime, args.offsetMinutes)
            : null,
        },
      });
      updatedPresentations++;
    }

    console.log(
      `\nTamamlandı: ${updatedSessions} Session, ${updatedPresentations} ` +
        'Presentation güncellendi, ilgili bildirim işleri yeniden planlandı.',
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
