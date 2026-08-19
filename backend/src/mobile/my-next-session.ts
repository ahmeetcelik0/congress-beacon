import { ProgramRoleType } from '../../generated/prisma/client';

// Kullanicinin (userId=me, matchStatus MATCHED/MANUAL) konusmaci/moderator/
// tartismaci oldugu tum oturum/sunumlar bu adaya donusturulup buraya
// verilir - karar mantigi (hangisi "sirada") saf, DB'den bagimsiz bir
// fonksiyonda tutulur ki test edilebilsin (bkz. Faz 5 talimati).
export type NextSessionCandidate = {
  sessionId: string;
  presentationId: string | null;
  title: string;
  hallName: string;
  startTime: Date;
  endTime: Date;
  roleType: ProgramRoleType;
};

export type NextSessionResult =
  (NextSessionCandidate & { isOngoing: boolean }) | null;

// Ana sayfadaki "siradaki sunumum" karti icin: SUREGELEN bir aday varsa
// (startTime <= now <= endTime) onu, yoksa GELECEKteki en yakini, o da
// yoksa null doner. Gecmiste kalan (endTime < now) adaylar hic bir zaman
// secilmez. Birden fazla suregelen/gelecek aday varsa en erken baslayan
// kazanir (deterministik siralama).
export function pickNextSession(
  candidates: NextSessionCandidate[],
  now: Date,
): NextSessionResult {
  const byStartTimeAsc = (a: NextSessionCandidate, b: NextSessionCandidate) =>
    a.startTime.getTime() - b.startTime.getTime();

  const ongoing = candidates
    .filter((c) => c.startTime <= now && now <= c.endTime)
    .sort(byStartTimeAsc);
  if (ongoing.length > 0) {
    return { ...ongoing[0], isOngoing: true };
  }

  const upcoming = candidates
    .filter((c) => c.startTime > now)
    .sort(byStartTimeAsc);
  if (upcoming.length > 0) {
    return { ...upcoming[0], isOngoing: false };
  }

  return null;
}
