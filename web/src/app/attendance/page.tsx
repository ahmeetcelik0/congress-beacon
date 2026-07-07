import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { KpiRow } from './components/kpi-row';
import { HallOccupancyGrid } from './components/hall-occupancy-grid';
import { LiveBadge } from './components/live-badge';
import { OccupancyChart } from './components/occupancy-chart';
import './tracking.css';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congresses = await api.listCongresses();
  const summary = congressId ? await api.getAttendanceSummary(congressId) : null;
  const occupancySeries = congressId
    ? await api.getOccupancySeries({ congressId, bucketMinutes: 15 })
    : null;

  return (
    <main className="tracking-page">
      <div className="tp-header">
        <div className="tp-title-block">
          <h1>Canlı Takip</h1>
          <p>Kongredeki salon yoğunluğunu ve katılımcı hareketini gerçek zamanlı izleyin.</p>
        </div>
        <div className="tp-header-controls">
          <CongressSelector
            congresses={congresses}
            selectedId={congressId}
            basePath="/attendance"
            className="tp-select"
          />
          <LiveBadge />
        </div>
      </div>

      {!congressId && <div className="tp-empty">Başlamak için yukarıdan bir kongre seçin.</div>}

      {congressId && summary && (
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

          {occupancySeries && (
            <section className="tp-section">
              <div className="tp-section-title">
                <h2>Yoğunluk (Bugün)</h2>
                <span>15 dk aralıklarla</span>
              </div>
              <OccupancyChart series={occupancySeries} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
