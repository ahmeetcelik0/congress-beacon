import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { LiveBadge } from './components/live-badge';
import { LiveDashboard } from './components/live-dashboard';
import { HallVisitsTable } from './components/hall-visits-table';
import { RawObservationFeed } from './components/raw-observation-feed';
import { ObservationIntervalControl } from './components/observation-interval-control';
import { DecisionTracePanel } from './components/decision-trace-panel';
import { AlgorithmTuningControl } from './components/algorithm-tuning-control';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';
import { DEFAULT_ROSTER_PAGE_SIZE } from '@/lib/hall-occupancy';
import './tracking.css';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="tracking-page">
        <PageHeader
          title="Canlı Takip"
          description="Kongredeki salon yoğunluğunu ve katılımcı hareketini gerçek zamanlı izleyin."
        />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const selectedCongress = congressId
    ? congresses.find((congress) => congress.id === congressId)
    : undefined;

  // Dört çağrı da kongre başına TEK istektir (salon sayısından bağımsız,
  // N+1 yok) ve birbirinden bağımsız oldukları için `Promise.all` ile
  // paralel çekilir — art arda `await` zaten mevcut olan gecikmeyi 4.
  // isteği (kapasiteler) eklerken daha da büyütmesin diye.
  const [summary, occupancySeries, roster, halls] = congressId
    ? await Promise.all([
        api.getAttendanceSummary(congressId),
        api.getOccupancySeries({ congressId, bucketMinutes: 15 }),
        api.listHallVisits({ congressId, isOpen: true, pageSize: DEFAULT_ROSTER_PAGE_SIZE }),
        api.listHalls(congressId),
      ])
    : [null, null, null, null];

  return (
    <main className="tracking-page">
      <PageHeader
        title="Canlı Takip"
        description="Kongredeki salon yoğunluğunu ve katılımcı hareketini gerçek zamanlı izleyin."
        actions={
          <>
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
          </>
        }
      />

      {!congressId && (
        <EmptyState
          title="Başlamak için yukarıdan bir kongre seçin."
          description="Canlı salon doluluğunu görmek için önce bir kongre seçmelisiniz."
        />
      )}

      {congressId && summary && occupancySeries && roster && halls && (
        <>
          {halls.length === 0 ? (
            <EmptyState
              title="Bu kongrede henüz salon tanımlı değil."
              description="Canlı takip için önce Salonlar sayfasından en az bir salon oluşturun."
            />
          ) : (
            <LiveDashboard
              key={congressId}
              congressId={congressId}
              initialSummary={summary}
              initialSeries={occupancySeries}
              initialRoster={roster.items}
              initialHalls={halls}
            />
          )}

          <section className="tp-section">
            <div className="tp-section-title">
              <h2>Katılımcı Salon Geçmişi</h2>
            </div>
            <HallVisitsTable congressId={congressId} halls={summary.hallOccupancy} />
          </section>

          <RawObservationFeed congressId={congressId} />

          <DecisionTracePanel congressId={congressId} />

          {selectedCongress && (
            <AlgorithmTuningControl
              key={`tuning-${selectedCongress.id}`}
              congressId={selectedCongress.id}
              initialValues={{
                emaAlpha: selectedCongress.emaAlpha,
                hampelK: selectedCongress.hampelK,
                hampelWindowSize: selectedCongress.hampelWindowSize,
                confidenceTemperature: selectedCongress.confidenceTemperature,
                entryProbabilityThreshold:
                  selectedCongress.entryProbabilityThreshold,
                exitProbabilityThreshold:
                  selectedCongress.exitProbabilityThreshold,
                ambiguityMarginPct: selectedCongress.ambiguityMarginPct,
                staleGraceSeconds: selectedCongress.staleGraceSeconds,
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
