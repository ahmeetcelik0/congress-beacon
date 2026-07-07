import { getHallColor } from '@/lib/hall-colors';
import type { HallOccupancy } from '@/lib/api';

export function HallOccupancyGrid({ halls }: { halls: HallOccupancy[] }) {
  if (halls.length === 0) {
    return <div className="tp-empty">Bu kongrede henüz salon tanımlı değil.</div>;
  }

  return (
    <div className="tp-hall-grid">
      {halls.map((hall, index) => {
        const color = getHallColor(hall.hallId);
        return (
          <div
            key={hall.hallId}
            className={`tp-hall-card tp-stagger-${Math.min(index + 1, 4)}`}
            style={{ ['--hall-color' as string]: color }}
          >
            <span className={`tp-hall-pulse ${hall.count > 0 ? 'tp-active' : ''}`} />
            <div className="tp-hall-name">{hall.hallName}</div>
            <div className="tp-hall-count">
              {hall.count}
              <small>kişi</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
