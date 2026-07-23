'use client';

import { useEffect, useState } from 'react';
import { api, type TrackingHealth } from '@/lib/api';

const REFRESH_INTERVAL_MS = 10_000;

const STATUS_LABEL: Record<string, string> = {
  aktif: 'Aktif',
  yakin_zamanda: 'Yakın zamanda',
  veri_yok: 'Veri yok',
};

const STATUS_CLASS: Record<string, string> = {
  aktif: 'th-badge th-active',
  yakin_zamanda: 'th-badge th-recent',
  veri_yok: 'th-badge th-none',
};

const PRESENCE_LABEL: Record<string, string> = {
  IN_HALL: 'İçeride',
  AMBIGUOUS: 'Belirsiz',
  NO_SIGNAL: 'Sinyal yok',
};

const PRESENCE_CLASS: Record<string, string> = {
  IN_HALL: 'th-badge th-active',
  AMBIGUOUS: 'th-badge th-recent',
  NO_SIGNAL: 'th-badge th-none',
};

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `%${Math.round(rate * 100)}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function TrackingHealthView({
  congressId,
  initialData,
}: {
  congressId: string;
  initialData: TrackingHealth;
}) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const interval = setInterval(() => {
      api
        .getTrackingHealth(congressId)
        .then(setData)
        .catch(() => {
          // sessizce yut; bir sonraki tick'te tekrar denenir
        });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [congressId]);

  return (
    <>
      <div className="th-summary">
        <span className="th-badge th-active">{data.summary.aktif} aktif</span>
        <span className="th-badge th-recent">{data.summary.yakinZamanda} yakın zamanda</span>
        <span className="th-badge th-none">{data.summary.veriYok} veri yok</span>
      </div>

      <div className="th-summary">
        <span className="th-badge th-active">{data.summary.icerde} içeride</span>
        <span className="th-badge th-recent">{data.summary.belirsiz} belirsiz</span>
        <span className="th-badge th-none">{data.summary.sinyalYok} sinyal yok</span>
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Katılımcı</th>
            <th>Cihaz</th>
            <th>Son Gözlem</th>
            <th title="Cihazın veri gönderme sağlığı">Veri Akışı</th>
            <th title="Salon tespit algoritmasına göre anlık konum durumu">Konum Durumu</th>
            <th title="Elenen anormal okumaların toplam okumalara oranı — sinyal ortamının gürültü göstergesi">
              Anormal Okuma
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.userId}>
              <td>
                {item.firstName} {item.lastName}
              </td>
              <td>{item.devicePlatform ?? '—'}</td>
              <td>{formatTime(item.lastObservationAt)}</td>
              <td>
                <span className={STATUS_CLASS[item.status]}>{STATUS_LABEL[item.status]}</span>
              </td>
              <td>
                <span className={PRESENCE_CLASS[item.currentStatus]}>
                  {PRESENCE_LABEL[item.currentStatus]}
                </span>
                {item.currentHallName && <> {item.currentHallName}</>}
              </td>
              <td>{formatRate(item.outlierRejectionRate)}</td>
            </tr>
          ))}
          {data.items.length === 0 && (
            <tr>
              <td colSpan={6}>Bu kongrede henüz katılımcı yok.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
