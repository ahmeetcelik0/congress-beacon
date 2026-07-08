'use client';

import { useEffect, useState } from 'react';
import type { HallOccupancy, HallVisitSummary } from '@/lib/api';
import { getHallColor } from '@/lib/hall-colors';

function formatElapsed(startedAt: string, now: number): string {
  const totalMinutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  if (totalMinutes < 1) return '<1 dk';
  if (totalMinutes < 60) return `${totalMinutes} dk`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

export function HallRoster({
  visits,
  halls,
}: {
  visits: HallVisitSummary[];
  halls: HallOccupancy[];
}) {
  // Freshness ile ayni neden: sunucu/istemci arasinda Date.now() farkli olacagi
  // icin hydration mismatch olmamasi adina gercek zamana yalnizca mount sonrasi geciyoruz.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // freshness.tsx ile ayni sebep: ilk deger de bir zamanlayici callback'inden
    // gelsin diye setTimeout(0) kullaniyoruz (react-hooks/set-state-in-effect).
    const bootstrap = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(bootstrap);
      clearInterval(interval);
    };
  }, []);

  if (halls.length === 0) {
    return <div className="tp-empty">Bu kongrede henüz salon tanımlı değil.</div>;
  }

  const byHall = new Map<string, HallVisitSummary[]>();
  for (const visit of visits) {
    const list = byHall.get(visit.hallId) ?? [];
    list.push(visit);
    byHall.set(visit.hallId, list);
  }

  return (
    <div className="tp-roster-grid">
      {halls.map((hall) => {
        const hallVisits = (byHall.get(hall.hallId) ?? [])
          .slice()
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        const color = getHallColor(hall.hallId);

        return (
          <div key={hall.hallId} className="tp-roster-card" style={{ ['--hall-color' as string]: color }}>
            <div className="tp-roster-title">{hall.hallName}</div>
            {hallVisits.length === 0 && <div className="tp-roster-empty">Şu an kimse yok</div>}
            <ul className="tp-roster-list">
              {hallVisits.map((visit) => (
                <li key={visit.id}>
                  <span>
                    {visit.userFirstName} {visit.userLastName}
                  </span>
                  <span className="tp-roster-time">{now === null ? '' : formatElapsed(visit.startedAt, now)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
