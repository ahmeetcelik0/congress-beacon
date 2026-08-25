'use client';

import { useEffect, useState } from 'react';
import { api, type HallVisitSummary, type HallVisitTrace } from '@/lib/api';
import { formatIstanbulDateTimeWithSeconds as formatDateTime } from '@/lib/congress-time';
import { ErrorState } from '@/components/ui/error-state';

const VISIT_LIMIT = 15;

// Uc durumu ayirt eder: taze okuma (etiket yok), grace suresiyle donmus
// (hala ortalamaya dahil, ELENMEDI), gercekten elenmis (Hampel/sentinel,
// ortalamaya hic girmedi). Onceden ikinci ve ucuncu durum ayni "(elendi)"
// etiketini paylasiyordu - bu, grace ile kazanilmis bir karari "elenmis"
// gibi gosterip yanlis izlenim veriyordu.
function readingSuffix(reading: { rawAccepted: boolean; stale?: boolean }): string {
  if (reading.rawAccepted) return '';
  if (reading.stale) return ' (donmuş · grace)';
  return ' (elendi)';
}

function TraceDetail({
  title,
  event,
}: {
  title: string;
  event: HallVisitTrace['entry'];
}) {
  if (!event?.decisionTrace) {
    return null;
  }

  const trace = event.decisionTrace;

  return (
    <div className="tp-trace-block">
      <div className="tp-trace-heading">
        {title} · {formatDateTime(event.occurredAt)}
        {event.confidenceScore !== null && (
          <> · %{Math.round(event.confidenceScore)}</>
        )}
      </div>

      <div className="tp-trace-meta">
        En yakın rakiple fark: %{trace.runnerUpGapPct.toFixed(1)} · elenen
        anormal okuma: {trace.rejectedOutliers}
      </div>

      {trace.candidates.map((candidate) => (
        <div key={candidate.hallId} className="tp-trace-candidate">
          <div>
            <strong>%{candidate.percentage.toFixed(1)}</strong> · ortalama{' '}
            {candidate.emaAverage.toFixed(1)} dBm ·{' '}
            {candidate.passesThreshold ? 'salon eşiğini geçti' : 'eşiğin altında'}
          </div>
          <div className="tp-trace-beacons">
            {candidate.beaconReadings.map((reading) => (
              <span key={reading.beaconId}>
                {reading.beaconId.slice(0, 8)}… {reading.emaValue.toFixed(1)}dBm
                {readingSuffix(reading)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// "Bu karar neden verildi" görünümü. Ham Gözlem Akışı panelinin yanında,
// aynı açılır-kapanır desende — ayrı bir sayfa değil.
export function DecisionTracePanel({ congressId }: { congressId: string }) {
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState<HallVisitSummary[] | null>(null);
  // Ziyaret LİSTESİNİN yüklenememesi ("gerçek hata") ile "bu kongrede v3
  // karar izi olan ziyaret yok" ("gerçek boş durum") birbirine karışmasın
  // diye ayrı tutulur — önceden ikisi de aynı "visits: []" ile temsil
  // ediliyordu, bu da hata durumunda yanlışlıkla "kayıt yok" mesajı
  // gösteriyordu.
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [visitsRetryTick, setVisitsRetryTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trace, setTrace] = useState<HallVisitTrace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    api
      .listHallVisits({ congressId, page: 1, pageSize: VISIT_LIMIT })
      .then((result) => {
        if (cancelled) return;
        setVisits(result.items);
        setVisitsError(null);
        // Karar izi yalnızca v3 kararlarında var; ilk uygun ziyaret seçilir.
        const firstTraceable = result.items.find(
          (visit) => visit.algorithmVersion === 'v3',
        );
        setSelectedId((current) => current ?? firstTraceable?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setVisitsError((previous) => previous ?? 'Ziyaret listesi alınamadı.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, congressId, visitsRetryTick]);

  useEffect(() => {
    if (!open || !selectedId) {
      return;
    }

    let cancelled = false;

    api
      .getHallVisitTrace(selectedId)
      .then((result) => {
        if (!cancelled) {
          setTrace(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrace(null);
          setError('Karar izi alınamadı.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedId]);

  const traceableVisits = (visits ?? []).filter(
    (visit) => visit.algorithmVersion === 'v3',
  );

  return (
    <section className="tp-section">
      <button
        type="button"
        className="tp-raw-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '▾' : '▸'} Karar gerekçesi (debug) — bir ziyaret neden bu salona
        atandı?
      </button>

      {open && (
        <div className="tp-raw-feed">
          {!visits && !visitsError && <div className="tp-empty">Yükleniyor…</div>}

          {visitsError && (
            <ErrorState
              title="Ziyaret listesi yüklenemedi."
              description={visitsError}
              action={
                <button type="button" onClick={() => setVisitsRetryTick((tick) => tick + 1)}>
                  Yeniden dene
                </button>
              }
            />
          )}

          {visits && !visitsError && traceableVisits.length === 0 && (
            <div className="tp-empty">
              Karar izi olan (v3) ziyaret yok. Eski kayıtlarda bu bilgi
              tutulmuyordu.
            </div>
          )}

          {!visitsError && traceableVisits.length > 0 && (
            <>
              <select
                className="tp-trace-select"
                value={selectedId ?? ''}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {traceableVisits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {visit.userFirstName} {visit.userLastName} · {visit.hallName}{' '}
                    · {formatDateTime(visit.startedAt)}
                  </option>
                ))}
              </select>

              {error && <div className="tp-empty">{error}</div>}

              {trace && (
                <>
                  <TraceDetail title="Giriş kararı" event={trace.entry} />
                  <TraceDetail title="Çıkış kararı" event={trace.exit} />
                  {!trace.entry?.decisionTrace && !trace.exit?.decisionTrace && (
                    <div className="tp-empty">
                      Bu ziyaret için karar izi bulunamadı.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
