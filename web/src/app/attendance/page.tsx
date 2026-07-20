import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { LiveBadge } from './components/live-badge';
import { LiveDashboard } from './components/live-dashboard';
import { HallVisitsTable } from './components/hall-visits-table';
import { RawObservationFeed } from './components/raw-observation-feed';
import { ObservationIntervalControl } from './components/observation-interval-control';
import './tracking.css';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congresses = await api.listCongresses();
  const selectedCongress = congressId
    ? congresses.find((congress) => congress.id === congressId)
    : undefined;
  const summary = congressId ? await api.getAttendanceSummary(congressId) : null;
  const occupancySeries = congressId
    ? await api.getOccupancySeries({ congressId, bucketMinutes: 15 })
    : null;
  const roster = congressId
    ? await api.listHallVisits({ congressId, isOpen: true, pageSize: 100 })
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
          />
          {selectedCongress && (
            <ObservationIntervalControl
              key={selectedCongress.id}
              congressId={selectedCongress.id}
              initialValue={selectedCongress.observationIntervalSeconds}
            />
          )}
          <LiveBadge />
        </div>
      </div>

      {!congressId && <div className="tp-empty">Başlamak için yukarıdan bir kongre seçin.</div>}

      {congressId && summary && occupancySeries && roster && (
        <>
          <LiveDashboard
            key={congressId}
            congressId={congressId}
            initialSummary={summary}
            initialSeries={occupancySeries}
            initialRoster={roster.items}
          />

          <section className="tp-section">
            <div className="tp-section-title">
              <h2>Katılımcı Salon Geçmişi</h2>
            </div>
            <HallVisitsTable congressId={congressId} halls={summary.hallOccupancy} />
          </section>

          <RawObservationFeed congressId={congressId} />
        </>
      )}
    </main>
  );
}
