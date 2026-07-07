'use client';

import { useEffect, useState } from 'react';
import { api, type ObservationSummary } from '@/lib/api';

const PAGE_SIZE = 20;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function RawObservationFeed({ congressId }: { congressId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ObservationSummary[] | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    api
      .listObservations({ congressId, page: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, congressId]);

  return (
    <section className="tp-section">
      <button
        type="button"
        className="tp-raw-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '▾' : '▸'} Ham gözlem akışı (debug) — son {PAGE_SIZE} okuma
      </button>

      {open && (
        <div className="tp-raw-feed">
          {!items && <div className="tp-empty">Yükleniyor…</div>}
          {items?.length === 0 && <div className="tp-empty">Henüz gözlem yok.</div>}
          {items?.map((observation) => (
            <div key={observation.id} className="tp-raw-row">
              <span>{formatTime(observation.serverReceivedAt)}</span>
              <span>
                major={observation.major} minor={observation.minor} rssi={observation.rssi}dBm
                {observation.beaconId ? '' : ' (eşleşmedi)'}
              </span>
              <span>{observation.userId.slice(0, 8)}…</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
