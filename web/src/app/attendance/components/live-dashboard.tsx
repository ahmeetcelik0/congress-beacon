'use client';

import { useEffect, useState } from 'react';
import { api, type AttendanceSummary, type OccupancySeries } from '@/lib/api';
import { KpiRow } from './kpi-row';
import { HallOccupancyGrid } from './hall-occupancy-grid';
import { OccupancyChart } from './occupancy-chart';

const REFRESH_INTERVAL_MS = 20_000;

export function LiveDashboard({
  congressId,
  initialSummary,
  initialSeries,
}: {
  congressId: string;
  initialSummary: AttendanceSummary;
  initialSeries: OccupancySeries;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [series, setSeries] = useState(initialSeries);

  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        api.getAttendanceSummary(congressId),
        api.getOccupancySeries({ congressId, bucketMinutes: 15 }),
      ])
        .then(([nextSummary, nextSeries]) => {
          setSummary(nextSummary);
          setSeries(nextSeries);
        })
        .catch(() => {
          // sessizce yut; bir sonraki tick'te tekrar denenir, onceki veri ekranda kalir
        });
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [congressId]);

  return (
    <>
      <KpiRow
        activeHalls={summary.activeHalls}
        currentlyInsideTotal={summary.currentlyInsideTotal}
        participantsSeenToday={summary.participantsSeenToday}
        lastObservationAt={summary.lastObservationAt}
      />

      <section className="tp-section">
        <div className="tp-section-title">
          <h2>Salon Doluluğu</h2>
          <span>canlı</span>
        </div>
        <HallOccupancyGrid halls={summary.hallOccupancy} />
      </section>

      <section className="tp-section">
        <div className="tp-section-title">
          <h2>Yoğunluk (Bugün)</h2>
          <span>15 dk aralıklarla</span>
        </div>
        <OccupancyChart series={series} />
      </section>
    </>
  );
}
