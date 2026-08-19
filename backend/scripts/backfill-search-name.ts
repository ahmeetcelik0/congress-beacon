// Faz 4a: Faz 4a ONCESI olusmus kullanicilarin `User.searchName` alanini
// geriye donuk doldurur. Migration icinde SQL ile yapilamadi (Turkce
// karakter/unvan normalizasyonu saf SQL ile pratik degil) - bu yuzden
// migration'dan SONRA elle bir kez calistirilir.
//
// Kullanim (once derle, sonra derlenmis JS'i calistir - bu projede ts-node
// ozel Prisma client cikti yolunu duzgun cozemiyor, bkz. create-admin.ts):
//   npm run build && node dist/scripts/backfill-search-name.js
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { computeSearchName } from '../src/common/normalize-turkish-name';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
  });

  const users = await prisma.user.findMany({
    where: { searchName: null },
    select: { id: true, firstName: true, lastName: true },
  });

  console.log(`${users.length} kullanici icin searchName hesaplanacak.`);

  let updated = 0;
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { searchName: computeSearchName(user.firstName, user.lastName) },
    });
    updated++;
  }

  console.log(`Tamamlandi: ${updated} kullanici guncellendi.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
