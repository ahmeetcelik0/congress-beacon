'use client';

import type { HallVisitSummary } from '@/lib/api';
import type { MergedHallOccupancy } from '@/lib/hall-occupancy';
import { EmptyState } from '@/components/ui/empty-state';
import { HallOccupancyCard } from './hall-occupancy-card';
import { useSharedNow } from './hall-participant-list';

const NOW_TICK_MS = 30_000;

export function HallOccupancyGrid({
  congressId,
  halls,
  roster,
}: {
  congressId: string;
  halls: MergedHallOccupancy[];
  roster: HallVisitSummary[];
}) {
  // Katılımcı satırlarındaki kalış süresi göstergeleri için TEK merkezi
  // zamanlayıcı — kart başına ayrı `setInterval` YOK.
  const now = useSharedNow(NOW_TICK_MS);

  if (halls.length === 0) {
    return <EmptyState title="Bu kongrede henüz salon tanımlı değil." />;
  }

  const visitsByHall = new Map<string, HallVisitSummary[]>();
  for (const visit of roster) {
    const list = visitsByHall.get(visit.hallId) ?? [];
    list.push(visit);
    visitsByHall.set(visit.hallId, list);
  }

  return (
    <div className="tp-occupancy-grid">
      {halls.map((hall) => (
        <HallOccupancyCard
          key={hall.hallId}
          congressId={congressId}
          hall={hall}
          visits={visitsByHall.get(hall.hallId) ?? []}
          now={now}
        />
      ))}
    </div>
  );
}
