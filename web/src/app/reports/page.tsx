import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { ReportsDownloadLink } from './reports-download-link';

function formatPercent(ratio: number | null): string {
  if (ratio === null) return '—';
  return `%${Math.round(ratio * 100)}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congresses = await api.listCongresses();
  const [dataQuality, beaconHealth] = congressId
    ? await Promise.all([
        api.getDataQualityReport(congressId),
        api.getBeaconHealthReport(congressId),
      ])
    : [null, null];

  return (
    <main className="panel-page">
      <h1>Raporlar</h1>
      <CongressSelector congresses={congresses} selectedId={congressId} basePath="/reports" />

      {!congressId && <p>Rapor görmek için bir kongre seçin.</p>}

      {congressId && dataQuality && (
        <>
          <h2>Veri Kalitesi</h2>
          <div className="panel-cards">
            <div className="panel-card">
              <span className="panel-card-label">Toplam gözlem</span>
              <span className="panel-card-value">{dataQuality.totalObservations}</span>
            </div>
            <div className="panel-card">
              <span className="panel-card-label">Eşleşen</span>
              <span className="panel-card-value">{dataQuality.matchedObservations}</span>
            </div>
            <div className="panel-card">
              <span className="panel-card-label">Eşleşmeyen</span>
              <span className="panel-card-value">{dataQuality.unmatchedObservations}</span>
            </div>
            <div className="panel-card">
              <span className="panel-card-label">Eşleşme oranı</span>
              <span className="panel-card-value">{formatPercent(dataQuality.matchedRatio)}</span>
            </div>
          </div>

          <h2>Beacon Sağlığı</h2>
          <table className="panel-table">
            <thead>
              <tr>
                <th>Etiket</th>
                <th>Major</th>
                <th>Minor</th>
                <th>Salon</th>
                <th>Gözlem Sayısı</th>
                <th>Son Görülme</th>
              </tr>
            </thead>
            <tbody>
              {beaconHealth?.map((beacon) => (
                <tr key={beacon.beaconId}>
                  <td>{beacon.label ?? '—'}</td>
                  <td>{beacon.major}</td>
                  <td>{beacon.minor}</td>
                  <td>{beacon.assignedHallName ?? 'atanmamış'}</td>
                  <td>{beacon.observationCount}</td>
                  <td>{formatTime(beacon.lastSeenAt)}</td>
                </tr>
              ))}
              {beaconHealth?.length === 0 && (
                <tr>
                  <td colSpan={6}>Bu kongrede henüz beacon yok.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h2>Dışa Aktar</h2>
          <ReportsDownloadLink congressId={congressId} />
        </>
      )}
    </main>
  );
}
