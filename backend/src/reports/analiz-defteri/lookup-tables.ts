import { PrismaService } from '../../prisma/prisma.service';

// Faz 13a: kullanıcı/beacon/salon/oturum bilgileri TÜM sayfalar tarafından
// tekrar tekrar aranacağı için (Ham Gözlem, Dakika Özeti, Salon Ziyaretleri,
// Kullanıcı-Salon Özeti), TEK SEFERDE çekilip Map olarak paylaşılır - her
// sayfa kendi N+1 sorgusunu YAZMAZ. Bu tablolar (kullanıcı/beacon/salon)
// gözlem hacmiyle KIYASLANAMAYACAK kadar küçüktür (yüzlerce/binlerce satır,
// milyonlarca değil) - filtre uygulanmadan kongrenin TAMAMI çekilir, bu
// bir bellek riski OLUŞTURMAZ.
export type LookupTables = {
  userNames: Map<string, string>;
  beaconLabels: Map<
    string,
    { label: string | null; major: number; minor: number }
  >;
  // beaconId -> o an aktif atandığı salon adı (yalnızca isActive=true).
  beaconHallNames: Map<string, string>;
  // hallId -> salon adı (Kullanıcı-Salon Özeti sayfası için).
  hallNames: Map<string, string>;
  // hallId -> o salondaki oturumlar (baslangic/bitis + baslik) - Salon
  // Ziyaretleri sayfasindaki "o sıradaki oturum" eşleştirmesi için.
  hallSessions: Map<
    string,
    { title: string; startTime: Date; endTime: Date }[]
  >;
};

export async function loadLookupTables(
  prisma: PrismaService,
  congressId: string,
): Promise<LookupTables> {
  const [users, beacons, hallBeacons, halls, sessions] = await Promise.all([
    prisma.user.findMany({
      where: { registrations: { some: { congressId, isActive: true } } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.beacon.findMany({
      where: { congressId },
      select: { id: true, label: true, major: true, minor: true },
    }),
    prisma.hallBeacon.findMany({
      where: { isActive: true, hall: { congressId } },
      select: { beaconId: true, hall: { select: { name: true } } },
    }),
    prisma.hall.findMany({
      where: { congressId },
      select: { id: true, name: true },
    }),
    prisma.session.findMany({
      where: { congressId },
      select: { hallId: true, title: true, startTime: true, endTime: true },
    }),
  ]);

  const userNames = new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
  );
  const beaconLabels = new Map(
    beacons.map((b) => [
      b.id,
      { label: b.label, major: b.major, minor: b.minor },
    ]),
  );
  const beaconHallNames = new Map(
    hallBeacons.map((hb) => [hb.beaconId, hb.hall.name]),
  );
  const hallNames = new Map(halls.map((h) => [h.id, h.name]));

  const hallSessions = new Map<
    string,
    { title: string; startTime: Date; endTime: Date }[]
  >();
  for (const session of sessions) {
    const list = hallSessions.get(session.hallId) ?? [];
    list.push({
      title: session.title,
      startTime: session.startTime,
      endTime: session.endTime,
    });
    hallSessions.set(session.hallId, list);
  }

  return { userNames, beaconLabels, beaconHallNames, hallNames, hallSessions };
}

/** "Beacon (etiket veya major/minor)" sütunu için ortak biçimlendirme. */
export function formatBeaconLabel(
  beaconId: string | null,
  major: number,
  minor: number,
  lookups: LookupTables,
): string {
  if (beaconId) {
    const beacon = lookups.beaconLabels.get(beaconId);
    if (beacon?.label) return beacon.label;
  }
  return `major=${major} minor=${minor}`;
}
