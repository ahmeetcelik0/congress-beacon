import { MetricCard } from '@/components/ui/metric-card';
import {
  calculateOccupancy,
  countActiveHalls,
  getOccupancyStatus,
  type MergedHallOccupancy,
} from '@/lib/hall-occupancy';
import { Freshness } from './freshness';

const NEAR_OR_OVER_CAPACITY_KEYS = new Set(['near-full', 'full', 'over-capacity']);

export function KpiRow({
  currentlyInsideTotal,
  participantsSeenToday,
  lastObservationAt,
  halls,
}: {
  currentlyInsideTotal: number;
  participantsSeenToday: number;
  lastObservationAt: string | null;
  halls: MergedHallOccupancy[];
}) {
  const activeHalls = countActiveHalls(halls);
  const hallsWithCapacity = halls.filter((hall) => hall.capacity != null).length;
  const hallsNearOrOverCapacity = halls.filter((hall) => {
    const status = getOccupancyStatus(calculateOccupancy(hall.count, hall.capacity));
    return NEAR_OR_OVER_CAPACITY_KEYS.has(status.key);
  }).length;

  return (
    <div className="ui-metric-grid">
      <MetricCard
        label="Şu An İçeride"
        value={currentlyInsideTotal}
        hint="tüm salonlar toplamı"
      />
      <MetricCard label="Aktif Salon" value={activeHalls} hint="en az 1 kişi olan salon" />
      <MetricCard
        label="Kapasitesi Tanımlı Salon"
        value={`${hallsWithCapacity}/${halls.length}`}
        hint="toplam salon içinde"
      />
      <MetricCard
        label="Kapasiteye Yaklaşan/Aşan"
        value={hallsNearOrOverCapacity}
        hint="%90 ve üzeri doluluk"
        className={hallsNearOrOverCapacity > 0 ? 'ui-metric-card-warning' : undefined}
      />
      <MetricCard
        label="Bugün Görülen Katılımcı"
        value={participantsSeenToday}
        hint="en az bir salon ziyareti"
      />
      <MetricCard
        label="Son Gözlem"
        value={<Freshness timestamp={lastObservationAt} />}
        hint="tüm salonlar için en son beacon okuması"
      />
    </div>
  );
}
