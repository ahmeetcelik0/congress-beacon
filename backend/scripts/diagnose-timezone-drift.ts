// Faz 12: SALT-OKUNUR teshis betigi. Hicbir veriyi DEGISTIRMEZ, sadece
// mevcut Session/Presentation saatlerinin kaymis olup olmadigini gosterir.
//
// Kullanim (once derle, sonra derlenmis JS'i calistir - bu projede ts-node
// ozel Prisma client cikti yolunu duzgun cozemiyor, bkz. create-admin.ts):
//   npm run build && node dist/scripts/diagnose-timezone-drift.js
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

type HourRow = { hour: number; count: bigint };

function printHourHistogram(title: string, rows: HourRow[]) {
  console.log(`\n${title}`);
  const byHour = new Map(rows.map((r) => [r.hour, Number(r.count)]));
  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
  for (let hour = 0; hour < 24; hour++) {
    const count = byHour.get(hour) ?? 0;
    if (count === 0) continue;
    const bar = '#'.repeat(Math.max(1, Math.round((count / total) * 40)));
    console.log(`  ${String(hour).padStart(2, '0')}:00 UTC  ${bar} ${count}`);
  }
  console.log(`  Toplam: ${total} kayit`);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
  });

  const sessionHours = await prisma.$queryRaw<HourRow[]>`
    SELECT HOUR(startTime) AS hour, COUNT(*) AS count
    FROM Session
    GROUP BY HOUR(startTime)
    ORDER BY hour
  `;
  printHourHistogram('Session.startTime - saat bazinda dagilim (UTC)', sessionHours);

  const presentationHours = await prisma.$queryRaw<HourRow[]>`
    SELECT HOUR(startTime) AS hour, COUNT(*) AS count
    FROM Presentation
    WHERE startTime IS NOT NULL
    GROUP BY HOUR(startTime)
    ORDER BY hour
  `;
  printHourHistogram(
    'Presentation.startTime - saat bazinda dagilim (UTC)',
    presentationHours,
  );

  type CongressRangeRow = {
    congressId: string;
    congressName: string;
    earliest: Date;
    latest: Date;
    sessionCount: bigint;
  };
  const congressRanges = await prisma.$queryRaw<CongressRangeRow[]>`
    SELECT
      s.congressId AS congressId,
      c.name AS congressName,
      MIN(s.startTime) AS earliest,
      MAX(s.startTime) AS latest,
      COUNT(*) AS sessionCount
    FROM Session s
    JOIN Congress c ON c.id = s.congressId
    GROUP BY s.congressId, c.name
    ORDER BY c.name
  `;
  console.log('\nKongre bazinda en erken / en gec oturum saati (UTC):');
  for (const row of congressRanges) {
    console.log(
      `  ${row.congressName}: ${row.earliest.toISOString()} - ` +
        `${row.latest.toISOString()} (${row.sessionCount} oturum)`,
    );
  }

  const totalSessions = await prisma.session.count();
  const totalPresentations = await prisma.presentation.count({
    where: { startTime: { not: null } },
  });
  console.log(
    `\nToplam kayit: ${totalSessions} Session, ${totalPresentations} zamanli Presentation`,
  );

  console.log(
    '\n--- YORUMLAMA ANAHTARI ---\n' +
      'Bir kongre programi tipik olarak sabah 08-09 civari baslar, aksam\n' +
      '18-19 civari biter. UTC dagilimi 05:00-16:00 araligindaysa veri\n' +
      'DOGRU (Turkiye saati UTC+3, 08:00 Turkiye = 05:00 UTC). UTC\n' +
      'dagilimi 08:00-19:00 araligindaysa veri UC SAAT ILERI (kaymis) -\n' +
      'onarim betigi (repair-timezone-drift.ts) calistirilmalidir.',
  );

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
