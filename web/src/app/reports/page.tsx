import { api, type NotificationDeliveryStatus } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { ReportsDownloadLink } from './reports-download-link';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { loadCongresses } from '@/lib/load-congresses';

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

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

const NOTIFICATION_STATUS_TONE: Record<NotificationDeliveryStatus, StatusTone> = {
  SENT: 'positive',
  FAILED: 'critical',
  SKIPPED: 'warning',
};

const NOTIFICATION_STATUS_LABEL: Record<NotificationDeliveryStatus, string> = {
  SENT: 'gönderildi',
  FAILED: 'başarısız',
  SKIPPED: 'atlandı',
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Raporlar" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const [dataQuality, beaconHealth, notificationSummary] = congressId
    ? await Promise.all([
        api.getDataQualityReport(congressId),
        api.getBeaconHealthReport(congressId),
        api.getNotificationSummaryReport(congressId),
      ])
    : [null, null, null];

  return (
    <main className="panel-page">
      <PageHeader
        title="Raporlar"
        actions={
          <CongressSelector congresses={congresses} selectedId={congressId} basePath="/reports" />
        }
      />

      {!congressId && (
        <EmptyState
          title="Rapor görmek için bir kongre seçin."
          description="Üstteki kongre seçiciden bir kongre seçtiğinizde veri kalitesi ve beacon sağlığı raporları burada görünecek."
        />
      )}

      {congressId && dataQuality && (
        <>
          <h2>Veri Kalitesi</h2>
          {dataQuality.consistencyWarning && (
            <p className="reports-consistency-warning" role="alert">
              {dataQuality.consistencyWarning}
            </p>
          )}
          <div className="ui-metric-grid">
            <MetricCard label="Toplam gözlem" value={dataQuality.totalObservations} />
            <MetricCard label="Eşleşen" value={dataQuality.matchedObservations} />
            <MetricCard label="Eşleşmeyen" value={dataQuality.unmatchedObservations} />
            <MetricCard label="Eşleşme oranı" value={formatPercent(dataQuality.matchedRatio)} />
            <MetricCard
              label="Kongre UUID'siyle uyuşmayan beacon"
              value={dataQuality.mismatchedBeaconCount}
            />
          </div>

          {dataQuality.topUnmatchedBeacons.length > 0 && (
            <>
              <h2>Eşleşmeyen Gözlemler (en çok görülen 10)</h2>
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>UUID</th>
                    <th>Major</th>
                    <th>Minor</th>
                    <th>Gözlem Sayısı</th>
                  </tr>
                </thead>
                <tbody>
                  {dataQuality.topUnmatchedBeacons.map((item) => (
                    <tr key={`${item.uuid}-${item.major}-${item.minor}`}>
                      <td>{item.uuid}</td>
                      <td>{item.major}</td>
                      <td>{item.minor}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h2>Beacon Sağlığı</h2>
          <table className="panel-table">
            <thead>
              <tr>
                <th>Etiket</th>
                <th>Major</th>
                <th>Minor</th>
                <th>Salon</th>
                <th>Gözlem Sayısı</th>
                <th title="Sentinel (rssi ≥ 0) okumalar hariç">Ortalama RSSI</th>
                <th title="Bu beacon'ı gören farklı katılımcı sayısı — kapsama göstergesi">
                  Gören Katılımcı
                </th>
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
                  <td>
                    {beacon.averageRssi === null
                      ? '—'
                      : `${beacon.averageRssi.toFixed(1)} dBm`}
                  </td>
                  <td>{beacon.usersSeenCount}</td>
                  <td>{formatTime(beacon.lastSeenAt)}</td>
                </tr>
              ))}
              {beaconHealth?.length === 0 && (
                <tr>
                  <td colSpan={8}>Bu kongrede henüz beacon yok.</td>
                </tr>
              )}
            </tbody>
          </table>

          {notificationSummary && (
            <>
              <h2>Bildirimler</h2>
              <div className="ui-metric-grid">
                <MetricCard label="Gönderilen" value={notificationSummary.sentCount} />
                <MetricCard label="Açılan" value={notificationSummary.openedCount} />
                <MetricCard
                  label="Açılma oranı"
                  value={formatPercent(notificationSummary.openedRatio)}
                  hint="açılan / gönderilen"
                />
                <MetricCard
                  label="Atlanan"
                  value={notificationSummary.skippedCount}
                  hint="saatlik gönderim sınırı nedeniyle"
                />
                <MetricCard label="Başarısız" value={notificationSummary.failedCount} />
              </div>

              <h3 className="reports-subheading">Son Gönderimler</h3>
              {notificationSummary.recent.length === 0 ? (
                <EmptyState title="Henüz bildirim gönderilmedi." />
              ) : (
                <table className="panel-table">
                  <thead>
                    <tr>
                      <th>Başlık</th>
                      <th>İçerik</th>
                      <th>Alıcı</th>
                      <th>Gönderim</th>
                      <th>Açılma</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificationSummary.recent.map((notification) => (
                      <tr key={notification.id}>
                        <td>{notification.title}</td>
                        <td title={notification.body}>{truncate(notification.body, 60)}</td>
                        <td>{notification.userName}</td>
                        <td>{formatTime(notification.sentAt)}</td>
                        <td>{formatTime(notification.openedAt)}</td>
                        <td>
                          <StatusBadge tone={NOTIFICATION_STATUS_TONE[notification.status]}>
                            {NOTIFICATION_STATUS_LABEL[notification.status]}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          <h2>Dışa Aktar</h2>
          <ReportsDownloadLink congressId={congressId} />
        </>
      )}
    </main>
  );
}
