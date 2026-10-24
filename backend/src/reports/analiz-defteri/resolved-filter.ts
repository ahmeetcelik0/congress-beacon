import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalizDefteriQueryDto,
  ANALIZ_DEFTERI_SAYFA_ANAHTARLARI,
  type AnalizDefteriSayfaAnahtari,
} from '../dto/analiz-defteri-query.dto';

// Faz 13a: hallIds filtresi, BeaconObservation/BeaconObservation-türevi
// sayfalarda (Ham Gözlem, Dakika Özeti) DOLAYLI uygulanır - bu tablonun
// kendi hallId alanı YOK, yalnızca beaconId var; salona ait olup olmadığı
// HallBeacon (aktif atama) üzerinden belirlenir. Bu yüzden hallIds ->
// beaconIds çözümlemesi TEK bir yerde yapılıp paylaşılır.
export type ResolvedFilter = {
  congressId: string;
  from: Date;
  to: Date;
  userIds: string[] | null;
  hallIds: string[] | null;
  // hallIds verildiyse, o salonlara AKTİF atanmış beacon id'leri - Ham
  // Gözlem/Dakika Özeti sorgularında `beaconId IN (...)` için kullanılır.
  // hallIds verilmediyse null (filtre uygulanmaz).
  beaconIdsForHallFilter: string[] | null;
  // Faz 13b: hangi sayfaların yazılacağı - `pages` boşsa TÜMÜ seçili
  // sayılır (varsayılan). Kapak bu kümenin DIŞINDA tutulur, her zaman
  // yazılır (bkz. `analiz-defteri.service.ts`).
  secilenSayfalar: Set<AnalizDefteriSayfaAnahtari>;
};

export function sayfaSecili(
  filter: ResolvedFilter,
  anahtar: AnalizDefteriSayfaAnahtari,
): boolean {
  return filter.secilenSayfalar.has(anahtar);
}

export async function resolveFilter(
  prisma: PrismaService,
  query: AnalizDefteriQueryDto,
): Promise<ResolvedFilter> {
  const hallIds =
    query.hallIds && query.hallIds.length > 0 ? query.hallIds : null;

  const beaconIdsForHallFilter = hallIds
    ? (
        await prisma.hallBeacon.findMany({
          where: { hallId: { in: hallIds }, isActive: true },
          select: { beaconId: true },
        })
      ).map((row) => row.beaconId)
    : null;

  const secilenSayfalar = new Set<AnalizDefteriSayfaAnahtari>(
    query.pages && query.pages.length > 0
      ? query.pages
      : ANALIZ_DEFTERI_SAYFA_ANAHTARLARI,
  );

  return {
    congressId: query.congressId,
    from: new Date(query.from),
    to: new Date(query.to),
    userIds: query.userIds && query.userIds.length > 0 ? query.userIds : null,
    hallIds,
    beaconIdsForHallFilter,
    secilenSayfalar,
  };
}
