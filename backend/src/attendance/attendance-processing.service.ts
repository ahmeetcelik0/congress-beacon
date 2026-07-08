import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceEventType } from '../../generated/prisma/client';
import { AcceptedSnapshot } from '../observations/observation-ingestion.service';

const ALGORITHM_VERSION = 'v1';
const ENTRY_STREAK_THRESHOLD = 2;
const EXIT_STREAK_THRESHOLD = 2;

type Candidate = { hallId: string; margin: number };

// RSSI'nin salon esiginin ne kadar uzerinde oldugu (marj, dB) - girisin ne kadar
// net/gurultusuz oldugunun kaba bir gostergesi. Mobil confidenceScore gondermiyor
// (mimari karari geregi), bu yuzden bu deger sunucu tarafinda hesaplaniyor.
function confidenceFromMargin(margin: number): string {
  if (margin >= 10) return 'yuksek';
  if (margin >= 4) return 'orta';
  return 'dusuk';
}

@Injectable()
export class AttendanceProcessingService {
  constructor(private readonly prisma: PrismaService) {}

  async processSnapshots(
    userId: string,
    snapshots: AcceptedSnapshot[],
  ): Promise<void> {
    const ordered = [...snapshots].sort(
      (a, b) => a.observedAt.getTime() - b.observedAt.getTime(),
    );

    for (const snapshot of ordered) {
      const candidate = await this.resolveCandidateHall(snapshot);
      await this.applySnapshot(userId, snapshot.observedAt, candidate);
    }
  }

  private async resolveCandidateHall(
    snapshot: AcceptedSnapshot,
  ): Promise<Candidate | null> {
    const matchedBeaconIds = snapshot.readings
      .filter((reading) => reading.beaconId)
      .map((reading) => reading.beaconId as string);

    if (matchedBeaconIds.length === 0) {
      return null;
    }

    const activeAssignments = await this.prisma.hallBeacon.findMany({
      where: { beaconId: { in: matchedBeaconIds }, isActive: true },
      include: { hall: true },
    });

    if (activeAssignments.length === 0) {
      return null;
    }

    const hallStats = new Map<
      string,
      { sum: number; count: number; threshold: number }
    >();

    for (const assignment of activeAssignments) {
      const reading = snapshot.readings.find(
        (r) => r.beaconId === assignment.beaconId,
      );
      if (!reading) continue;

      const threshold =
        assignment.rssiThreshold ?? assignment.hall.rssiThreshold;
      const entry = hallStats.get(assignment.hallId) ?? {
        sum: 0,
        count: 0,
        threshold,
      };
      entry.sum += reading.rssi;
      entry.count += 1;
      hallStats.set(assignment.hallId, entry);
    }

    let bestHallId: string | null = null;
    let bestAverage = -Infinity;
    let bestMargin = 0;

    for (const [hallId, stats] of hallStats) {
      const average = stats.sum / stats.count;
      if (average >= stats.threshold && average > bestAverage) {
        bestAverage = average;
        bestHallId = hallId;
        bestMargin = average - stats.threshold;
      }
    }

    return bestHallId ? { hallId: bestHallId, margin: bestMargin } : null;
  }

  private async applySnapshot(
    userId: string,
    observedAt: Date,
    candidate: Candidate | null,
  ): Promise<void> {
    const candidateHallId = candidate?.hallId ?? null;
    await this.prisma.$transaction(async (tx) => {
      const state =
        (await tx.userPresenceState.findUnique({ where: { userId } })) ??
        (await tx.userPresenceState.create({ data: { userId } }));

      const openVisit = state.openHallVisitId
        ? await tx.hallVisit.findUnique({
            where: { id: state.openHallVisitId },
          })
        : null;

      // Aday, acik ziyaretin salonuyla ayni: dogrulama, aday takibini sifirla.
      if (
        openVisit &&
        candidateHallId &&
        candidateHallId === openVisit.hallId
      ) {
        await tx.hallVisit.update({
          where: { id: openVisit.id },
          data: { lastConfirmedAt: observedAt },
        });
        await tx.userPresenceState.update({
          where: { userId },
          data: {
            nonQualifyingStreak: 0,
            candidateHallId: null,
            candidateStreak: 0,
          },
        });
        return;
      }

      // Acik ziyaretle uyusmuyor (veya aday yok): cikis sayacini ilerlet.
      if (openVisit) {
        const nonQualifyingStreak = state.nonQualifyingStreak + 1;

        if (nonQualifyingStreak >= EXIT_STREAK_THRESHOLD) {
          await tx.hallVisit.update({
            where: { id: openVisit.id },
            data: { isOpen: false, endedAt: openVisit.lastConfirmedAt },
          });
          await tx.attendanceEvent.create({
            data: {
              userId,
              hallId: openVisit.hallId,
              type: AttendanceEventType.EXIT,
              occurredAt: openVisit.lastConfirmedAt,
              algorithmVersion: ALGORITHM_VERSION,
            },
          });
          await tx.userPresenceState.update({
            where: { userId },
            data: { openHallVisitId: null, nonQualifyingStreak: 0 },
          });
        } else {
          await tx.userPresenceState.update({
            where: { userId },
            data: { nonQualifyingStreak },
          });
        }
      }

      if (!candidateHallId) {
        await tx.userPresenceState.update({
          where: { userId },
          data: { candidateHallId: null, candidateStreak: 0 },
        });
        return;
      }

      const currentState = await tx.userPresenceState.findUniqueOrThrow({
        where: { userId },
      });

      if (currentState.candidateHallId !== candidateHallId) {
        await tx.userPresenceState.update({
          where: { userId },
          data: { candidateHallId, candidateStreak: 1 },
        });
        return;
      }

      const candidateStreak = currentState.candidateStreak + 1;

      if (candidateStreak < ENTRY_STREAK_THRESHOLD) {
        await tx.userPresenceState.update({
          where: { userId },
          data: { candidateStreak },
        });
        return;
      }

      // Giris onaylandi. Farkli bir salonda hala acik ziyaret varsa once onu kapat.
      if (currentState.openHallVisitId) {
        const staleVisit = await tx.hallVisit.findUnique({
          where: { id: currentState.openHallVisitId },
        });
        if (staleVisit && staleVisit.hallId !== candidateHallId) {
          await tx.hallVisit.update({
            where: { id: staleVisit.id },
            data: { isOpen: false, endedAt: staleVisit.lastConfirmedAt },
          });
          await tx.attendanceEvent.create({
            data: {
              userId,
              hallId: staleVisit.hallId,
              type: AttendanceEventType.EXIT,
              occurredAt: staleVisit.lastConfirmedAt,
              algorithmVersion: ALGORITHM_VERSION,
            },
          });
        }
      }

      const newVisit = await tx.hallVisit.create({
        data: {
          userId,
          hallId: candidateHallId,
          startedAt: observedAt,
          lastConfirmedAt: observedAt,
          algorithmVersion: ALGORITHM_VERSION,
          confidenceLevel: confidenceFromMargin(candidate!.margin),
        },
      });

      await tx.attendanceEvent.create({
        data: {
          userId,
          hallId: candidateHallId,
          type: AttendanceEventType.ENTRY,
          occurredAt: observedAt,
          algorithmVersion: ALGORITHM_VERSION,
          confidenceScore: candidate!.margin,
        },
      });

      await tx.userPresenceState.update({
        where: { userId },
        data: {
          openHallVisitId: newVisit.id,
          candidateHallId: null,
          candidateStreak: 0,
          nonQualifyingStreak: 0,
        },
      });
    });
  }
}
