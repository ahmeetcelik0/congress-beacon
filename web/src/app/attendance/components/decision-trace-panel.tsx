'use client';

import { useEffect, useState } from 'react';
import { api, type HallVisitSummary, type HallVisitTrace } from '@/lib/api';

const VISIT_LIMIT = 15;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
                {reading.rawAccepted ? '' : ' (elendi)'}
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
        // Karar izi yalnızca v3 kararlarında var; ilk uygun ziyaret seçilir.
        const firstTraceable = result.items.find(
          (visit) => visit.algorithmVersion === 'v3',
        );
        setSelectedId((current) => current ?? firstTraceable?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setVisits([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, congressId]);

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
          {!visits && <div className="tp-empty">Yükleniyor…</div>}

          {visits && traceableVisits.length === 0 && (
            <div className="tp-empty">
              Karar izi olan (v3) ziyaret yok. Eski kayıtlarda bu bilgi
              tutulmuyordu.
            </div>
          )}

          {traceableVisits.length > 0 && (
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
