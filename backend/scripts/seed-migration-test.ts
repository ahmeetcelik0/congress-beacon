// Faz 1 (kimlik modeli) migration'ini elle dogrulamak icin kucuk bir test
// veri seti uretir: 2 kongre, kongre basina 3 kullanici (CongressRegistration
// ile baglanmis), birkac HallVisit. Tekrar calistirilabilir - onceki
// SEEDTEST- verisini once temizler.
//
// Kullanim: once `npm run build`, sonra `node dist/scripts/seed-migration-test.js`
// ("npx ts-node scripts/..." DEGIL - Prisma'nin nodenext ciktisi ts-node'un
// CJS transpilasyonuyla runtime'da cozumlenemiyor; create-admin.ts ile ayni
// bilinen kisit).
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  PrismaClient,
  RegistrationSource,
} from '../generated/prisma/client';

const CODE_PREFIX = 'SEEDTEST-';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
  });

  // Onceki calistirmadan kalan test verisini temizle (FK sirasina dikkat).
  const previousCongresses = await prisma.congress.findMany({
    where: { code: { startsWith: CODE_PREFIX } },
    select: { id: true },
  });
  const previousCongressIds = previousCongresses.map((c) => c.id);
  if (previousCongressIds.length > 0) {
    // AttendanceEvent onceden silinmeli: HallVisit'i acik biraktigimizda,
    // arka planda calisan gercek stale-visit-sweep is'i (bkz. backend/src/
    // attendance/stale-visit-sweep.service.ts) onu bayat bulup kendiliginden
    // kapatip bir EXIT event'i yazabiliyor - bu yuzden User'i silmeden once
    // HallVisit disinda AttendanceEvent de temizlenmeli.
    await prisma.attendanceEvent.deleteMany({
      where: { hall: { congressId: { in: previousCongressIds } } },
    });
    await prisma.hallVisit.deleteMany({
      where: { hall: { congressId: { in: previousCongressIds } } },
    });
    const previousUsers = await prisma.congressRegistration.findMany({
      where: { congressId: { in: previousCongressIds } },
      select: { userId: true },
    });
    await prisma.congressRegistration.deleteMany({
      where: { congressId: { in: previousCongressIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: previousUsers.map((u) => u.userId) } },
    });
    await prisma.hall.deleteMany({
      where: { congressId: { in: previousCongressIds } },
    });
    await prisma.congress.deleteMany({
      where: { id: { in: previousCongressIds } },
    });
  }

  for (let congressIndex = 1; congressIndex <= 2; congressIndex++) {
    const congress = await prisma.congress.create({
      data: {
        name: `Seed Test Kongresi ${congressIndex}`,
        code: `${CODE_PREFIX}${congressIndex}`,
        accessCode: `seed-access-${congressIndex}`,
        beaconUuid: `00000000-0000-0000-0000-00000000000${congressIndex}`,
      },
    });

    const hall = await prisma.hall.create({
      data: {
        congressId: congress.id,
        name: `Seed Salon ${congressIndex}`,
        rssiThreshold: -70,
      },
    });

    for (let userIndex = 1; userIndex <= 3; userIndex++) {
      const user = await prisma.user.create({
        data: {
          firstName: `SeedKullanici${congressIndex}`,
          lastName: `Test${userIndex}`,
          phoneLast4: `100${congressIndex}${userIndex}`.slice(-4),
          registrations: {
            create: {
              congressId: congress.id,
              source: RegistrationSource.MANUAL,
            },
          },
        },
      });

      // Ilk kullanici icin kapali, ikinci icin acik bir HallVisit uret -
      // migration sonrasi ziyaret verisinin bozulmadigini gormek icin.
      if (userIndex === 1) {
        const startedAt = new Date();
        startedAt.setMinutes(startedAt.getMinutes() - 30);
        const endedAt = new Date();
        endedAt.setMinutes(endedAt.getMinutes() - 5);
        await prisma.hallVisit.create({
          data: {
            userId: user.id,
            hallId: hall.id,
            startedAt,
            lastConfirmedAt: endedAt,
            endedAt,
            isOpen: false,
            confidenceLevel: 'yuksek',
            algorithmVersion: 'v3',
          },
        });
      } else if (userIndex === 2) {
        const startedAt = new Date();
        startedAt.setMinutes(startedAt.getMinutes() - 10);
        await prisma.hallVisit.create({
          data: {
            userId: user.id,
            hallId: hall.id,
            startedAt,
            lastConfirmedAt: startedAt,
            isOpen: true,
            confidenceLevel: 'orta',
            algorithmVersion: 'v3',
          },
        });
      }
    }

    console.log(`Kongre hazir: ${congress.name} (${congress.code})`);
  }

  const registrationCount = await prisma.congressRegistration.count({
    where: { congress: { code: { startsWith: CODE_PREFIX } } },
  });
  console.log(`Toplam CongressRegistration: ${registrationCount} (6 olmali)`);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
