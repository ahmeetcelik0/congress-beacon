import Link from 'next/link';
import { api, type RegistrationImportRowStatus } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ImportRow } from './import-row';
import { ImportApprovePanel } from './import-approve-panel';
import '../../registrations.css';

const ROW_STATUSES: RegistrationImportRowStatus[] = ['NEW', 'MATCHED', 'DUPLICATE', 'INVALID', 'EXCLUDED'];

const STATUS_TAB_LABELS: Record<RegistrationImportRowStatus, string> = {
  NEW: 'Yeni',
  MATCHED: 'Eşleşti',
  DUPLICATE: 'Tekrar',
  INVALID: 'Geçersiz',
  EXCLUDED: 'Çıkarıldı',
};

function isValidRowStatus(value: string | undefined): value is RegistrationImportRowStatus {
  return !!value && (ROW_STATUSES as string[]).includes(value);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ congressId?: string; status?: string; page?: string; recognized?: string; unrecognized?: string }>;
}) {
  const { id } = await params;
  const { congressId, status, page, recognized, unrecognized } = await searchParams;

  const rowStatus = isValidRowStatus(status) ? status : undefined;
  const parsedPage = page ? Number(page) : undefined;
  const currentPage = parsedPage && Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const detail = await api.getRegistrationImport(id, { status: rowStatus, page: currentPage });

  const backHref = congressId ? `/registrations?congressId=${congressId}` : '/registrations';
  const counts = detail.counts;
  const toProcess = (counts.NEW ?? 0) + (counts.MATCHED ?? 0);
  const toSkip = (counts.DUPLICATE ?? 0) + (counts.INVALID ?? 0) + (counts.EXCLUDED ?? 0);
  const totalPages = Math.max(1, Math.ceil(detail.total / detail.pageSize));

  const recognizedColumns = recognized ? recognized.split(',').filter(Boolean) : [];
  const unrecognizedColumns = unrecognized ? unrecognized.split(',').filter(Boolean) : [];

  function tabHref(targetStatus?: RegistrationImportRowStatus) {
    const query = new URLSearchParams();
    if (congressId) query.set('congressId', congressId);
    if (targetStatus) query.set('status', targetStatus);
    const qs = query.toString();
    return `/registrations/imports/${id}${qs ? `?${qs}` : ''}`;
  }

  function pageHref(targetPage: number) {
    const query = new URLSearchParams();
    if (congressId) query.set('congressId', congressId);
    if (rowStatus) query.set('status', rowStatus);
    query.set('page', String(targetPage));
    return `/registrations/imports/${id}?${query.toString()}`;
  }

  return (
    <main className="panel-page">
      <PageHeader
        title="İçe Aktarma Önizleme"
        description={detail.import.fileName}
        actions={<Link href={backHref}>← Katılımcılar sayfasına dön</Link>}
      />

      <div className="reg-import-meta">
        <span>
          Toplam satır: <strong>{detail.import.totalRows.toLocaleString('tr-TR')}</strong>
        </span>
        <span>
          Yüklenme tarihi: <strong>{formatDateTime(detail.import.createdAt)}</strong>
        </span>
      </div>

      <div className="ui-metric-grid">
        <MetricCard label="Yeni" value={counts.NEW ?? 0} />
        <MetricCard label="Eşleşti" value={counts.MATCHED ?? 0} />
        <MetricCard label="Tekrar" value={counts.DUPLICATE ?? 0} />
        <MetricCard label="Geçersiz" value={counts.INVALID ?? 0} />
        <MetricCard label="Çıkarıldı" value={counts.EXCLUDED ?? 0} />
      </div>

      {(recognizedColumns.length > 0 || unrecognizedColumns.length > 0) && (
        <div className="reg-import-columns">
          {recognizedColumns.length > 0 && (
            <p>
              <strong>Tanınan kolonlar:</strong> {recognizedColumns.join(', ')}
            </p>
          )}
          {unrecognizedColumns.length > 0 && (
            <p>
              <strong>Tanınmayan kolonlar (yok sayıldı):</strong> {unrecognizedColumns.join(', ')}
            </p>
          )}
        </div>
      )}

      <nav className="reg-status-tabs" aria-label="Satır durumuna göre filtrele">
        <Link
          href={tabHref(undefined)}
          className="reg-status-tab"
          data-active={!rowStatus}
          aria-current={!rowStatus ? 'true' : undefined}
        >
          Tümü ({detail.import.totalRows})
        </Link>
        {ROW_STATUSES.map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            className="reg-status-tab"
            data-active={rowStatus === s}
            aria-current={rowStatus === s ? 'true' : undefined}
          >
            {STATUS_TAB_LABELS[s]} ({counts[s] ?? 0})
          </Link>
        ))}
      </nav>

      {detail.rows.length === 0 ? (
        <EmptyState title="Bu filtrede satır bulunamadı." />
      ) : (
        <table className="panel-table">
          <thead>
            <tr>
              <th>Satır</th>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Telefon</th>
              <th>Durum</th>
              <th>Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.map((row) => (
              <ImportRow
                key={row.id}
                row={row}
                importId={id}
                editable={detail.import.status === 'DRAFT'}
              />
            ))}
          </tbody>
        </table>
      )}

      <div className="reg-pagination">
        <span>
          {detail.total} kayıt · sayfa {currentPage}/{totalPages}
        </span>
        <div className="reg-pagination-buttons">
          <Link
            href={pageHref(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage <= 1}
            tabIndex={currentPage <= 1 ? -1 : undefined}
            className={currentPage <= 1 ? 'reg-pagination-disabled' : undefined}
          >
            Önceki
          </Link>
          <Link
            href={pageHref(Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage >= totalPages}
            tabIndex={currentPage >= totalPages ? -1 : undefined}
            className={currentPage >= totalPages ? 'reg-pagination-disabled' : undefined}
          >
            Sonraki
          </Link>
        </div>
      </div>

      <ImportApprovePanel
        importId={id}
        status={detail.import.status}
        toProcess={toProcess}
        toSkip={toSkip}
      />
    </main>
  );
}
