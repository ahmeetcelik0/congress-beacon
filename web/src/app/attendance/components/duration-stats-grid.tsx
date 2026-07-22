import { getHallColor } from '@/lib/hall-colors';
import type { HallDurationStats } from '@/lib/api';

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} dk`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours} sa ${mins} dk` : `${hours} sa`;
}

export function DurationStatsGrid({ stats }: { stats: HallDurationStats[] }) {
  if (stats.length === 0) {
    return <div className="tp-empty">Bu kongrede henüz salon tanımlı değil.</div>;
  }

  return (
    <div className="tp-hall-grid">
      {stats.map((hall, index) => {
        const color = getHallColor(hall.hallId);
        return (
          <div
            key={hall.hallId}
            className={`tp-hall-card tp-stagger-${Math.min(index + 1, 4)}`}
            style={{ ['--hall-color' as string]: color }}
          >
            <div className="tp-hall-name">{hall.hallName}</div>
            <div className="tp-hall-count" style={{ fontSize: '1.4rem' }}>
              {formatMinutes(hall.averageMinutes)}
              <small>ortalama</small>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--tp-text-dim)', marginTop: '0.35rem' }}>
              medyan {formatMinutes(hall.medianMinutes)} · {hall.visitCount} tamamlanan ziyaret
            </div>
            {hall.averageConfidenceScore !== null && (
              <div
                style={{ fontSize: '0.78rem', color: 'var(--tp-text-dim)', marginTop: '0.2rem' }}
                title="Bu salona yapılan girişlerin ortalama güven yüzdesi — beacon yerleşiminin ne kadar net çalıştığının göstergesi."
              >
                ortalama güven %{Math.round(hall.averageConfidenceScore)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
