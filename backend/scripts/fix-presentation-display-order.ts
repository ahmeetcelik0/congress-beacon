// Faz 10: TEK SEFERLIK duzeltme betigi. `program-imports.service.ts`
// `approveImport` fonksiyonu, staging'deki dosya sirasini
// (`ProgramImportPresentation.rowOrder`) canli `Presentation.displayOrder`a
// YAZMIYORDU - onaylanan tum sunumlar varsayilan displayOrder=0 ile
// olusuyordu (bkz. docs/decisions.md "Faz 10"). Kod duzeltildi (bkz.
// program-imports.service.ts), ama BU BETIKTEN ONCE onaylanmis programlardaki
// sunumlar hala displayOrder=0 ile duruyor - mobilde MySQL'in tanimsiz
// donus sirasinda goruniyorlar.
//
// Bu betik her oturumun sunumlarini yeniden siralar: startTime DOLU olanlar
// saatlerine gore, BOS olanlar (ör. "Tartisma" gibi saatsiz kayitlar) en
// SONA, aralarinda `createdAt`e (onay sirasinda olusturulma sirasi, dosya
// sirasini yansitir) gore. Ardindan displayOrder'i 0'dan baslayarak yeniden
// yazar. Zaten dogru sirali (Faz 10 duzeltmesinden SONRA onaylanmis)
// oturumlar ATLANIR - betik idempotenttir, birden fazla kez calistirmak
// guvenlidir.
//
// Kullanim:
//   npx tsx scripts/fix-presentation-display-order.ts [congressId]
// congressId verilmezse TUM kongrelerdeki oturumlar taranir.
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
  const congressId = process.argv[2];

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
  });

  const sessions = await prisma.session.findMany({
    where: congressId ? { congressId } : undefined,
    select: {
      id: true,
      title: true,
      presentations: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          startTime: true,
          displayOrder: true,
        },
      },
    },
  });

  console.log(
    `${sessions.length} oturum taranacak${congressId ? ` (congressId=${congressId})` : ' (tum kongreler)'}.`,
  );

  let fixedSessions = 0;
  let fixedPresentations = 0;

  for (const session of sessions) {
    if (session.presentations.length <= 1) continue;

    // `createdAt: 'asc'` ile zaten cekildigi icin bu dizi ONAY SIRASINDA
    // yazilma sirasindadir (dosya sirasiyla ayni) - startTime'i olmayan
    // sunumlar icin bu sira KORUNUR (stable sort).
    const sorted = [...session.presentations].sort((a, b) => {
      const aTime = a.startTime?.getTime();
      const bTime = b.startTime?.getTime();
      if (aTime === undefined && bTime === undefined) return 0;
      if (aTime === undefined) return 1;
      if (bTime === undefined) return -1;
      return aTime - bTime;
    });

    const alreadyCorrect = sorted.every((p, index) => p.displayOrder === index);
    if (alreadyCorrect) continue;

    for (let index = 0; index < sorted.length; index++) {
      const presentation = sorted[index];
      if (presentation.displayOrder === index) continue;
      await prisma.presentation.update({
        where: { id: presentation.id },
        data: { displayOrder: index },
      });
      fixedPresentations++;
    }
    fixedSessions++;
    console.log(
      `  duzeltildi: "${session.title}" (${session.presentations.length} sunum)`,
    );
  }

  console.log(
    `Tamamlandi: ${fixedSessions} oturumda toplam ${fixedPresentations} sunumun displayOrder'i duzeltildi.`,
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
