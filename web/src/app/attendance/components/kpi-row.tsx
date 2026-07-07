import { Freshness } from './freshness';

export function KpiRow({
  activeHalls,
  currentlyInsideTotal,
  participantsSeenToday,
  lastObservationAt,
}: {
  activeHalls: number;
  currentlyInsideTotal: number;
  participantsSeenToday: number;
  lastObservationAt: string | null;
}) {
  return (
    <div className="tp-kpi-row">
      <div className="tp-kpi-card tp-stagger-1" style={{ ['--card-accent' as string]: 'var(--tp-accent)' }}>
        <span className="tp-kpi-label">Şu An İçeride</span>
        <span className="tp-kpi-value">{currentlyInsideTotal}</span>
        <span className="tp-kpi-hint">tüm salonlar toplamı</span>
      </div>
      <div className="tp-kpi-card tp-stagger-2">
        <span className="tp-kpi-label">Bugün Görülen Katılımcı</span>
        <span className="tp-kpi-value">{participantsSeenToday}</span>
        <span className="tp-kpi-hint">en az bir salon ziyareti</span>
      </div>
      <div className="tp-kpi-card tp-stagger-3">
        <span className="tp-kpi-label">Aktif Salon</span>
        <span className="tp-kpi-value">{activeHalls}</span>
      </div>
      <div className="tp-kpi-card tp-stagger-4">
        <span className="tp-kpi-label">Son Gözlem</span>
        <span className="tp-kpi-value" style={{ fontSize: '1.15rem' }}>
          <Freshness timestamp={lastObservationAt} />
        </span>
      </div>
    </div>
  );
}
