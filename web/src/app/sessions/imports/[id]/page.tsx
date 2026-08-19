import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/error-state';
import { MATCH_STATUS_LABELS } from '../../role-status';
import { IMPORT_STATUS_LABELS, IMPORT_STATUS_TONES } from '../status-labels';
import { StatusPoller } from './status-poller';
import { CancelImportButton } from './cancel-import-button';
import { ImportPreviewBoard } from './import-preview-board';
import { ApprovePanel } from './approve-panel';
import { HallsToCreatePanel } from './halls-to-create-panel';
// Bu route `/sessions`ten AYRI bir sayfa oldugu icin (kok layout sadece
// globals.css yukler) - `sessions.css`teki paylasilan kart/rol/sunum
// siniflarini (sessions-card-toggle, sessions-role-form, sessions-presentation-*
// vb.) yeniden kullanabilmek icin BURADA da acikca import edilmesi gerekir
// (bkz. Faz 2 `registrations/imports/[id]/page.tsx` ile ayni gerekce).
import '../../sessions.css';
import '../imports.css';

const SOURCE_TYPE_LABELS = { PDF: 'PDF', EXCEL: 'Excel', JSON: 'JSON' } as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUsd(value: number | null): string {
  if (value === null) return 'hesaplanamadı';
  if (value > 0 && value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export default async function ProgramImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ congressId?: string; page?: string; pageSize?: string }>;
}) {
  const { id } = await params;
  const { congressId: congressIdParam, page } = await searchParams;

  const parsedPage = page ? Number(page) : undefined;
  const currentPage = parsedPage && Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const detail = await api.getProgramImport(id, { page: currentPage, pageSize: 20 });
  const { import: importRecord, sessions, summary, total, pageSize } = detail;
  const congressId = congressIdParam ?? importRecord.congressId;
  const backHref = `/sessions?congressId=${congressId}`;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const query = new URLSearchParams({ congressId });
    query.set('page', String(targetPage));
    return `/sessions/imports/${id}?${query.toString()}`;
  }

  // PENDING/EXTRACTING: staging agaci henuz YOK, LLM cikarimi arka planda
  // (BullMQ) suruyor - `StatusPoller` birkac saniyede bir bu sayfayi
  // tazeler, terminal bir duruma gecince kendini durdurur.
  if (importRecord.status === 'PENDING' || importRecord.status === 'EXTRACTING') {
    return (
      <main className="panel-page">
        <PageHeader
          title="Program Yükleme Önizleme"
          description={importRecord.fileName}
          actions={<Link href={backHref}>← Bilimsel Program sayfasına dön</Link>}
        />
        <StatusPoller status={importRecord.status} />
        <div className="import-status-screen" role="status">
          <StatusBadge tone={IMPORT_STATUS_TONES[importRecord.status]}>
            {IMPORT_STATUS_LABELS[importRecord.status]}
          </StatusBadge>
          <p className="import-status-message">
            Dosyanız yapay zeka ile işleniyor. Bu, dosya boyutuna bağlı olarak birkaç dakika
            sürebilir. Bu sayfa otomatik olarak güncellenecektir, pencereyi kapatabilirsiniz.
          </p>
          <CancelImportButton importId={id} />
        </div>
      </main>
    );
  }

  const halls = await api.listHalls(congressId);
  const existingSessionsCount =
    importRecord.status === 'DRAFT' ? (await api.listSessions(congressId)).length : 0;

  const sessionsByStatus = summary.sessionsByStatus;
  const rolesByMatchStatus = summary.rolesByMatchStatus;
  const toProcess = sessionsByStatus.NEW ?? 0;
  const toSkip = (sessionsByStatus.INVALID ?? 0) + (sessionsByStatus.EXCLUDED ?? 0);

  return (
    <main className="panel-page">
      <PageHeader
        title="Program Yükleme Önizleme"
        description={importRecord.fileName}
        actions={<Link href={backHref}>← Bilimsel Program sayfasına dön</Link>}
      />

      <div className="import-meta">
        <span>
          Durum:{' '}
          <StatusBadge tone={IMPORT_STATUS_TONES[importRecord.status]}>
            {IMPORT_STATUS_LABELS[importRecord.status]}
          </StatusBadge>
        </span>
        <span>
          Kaynak: <strong>{SOURCE_TYPE_LABELS[importRecord.sourceType]}</strong>
        </span>
        <span>
          Yüklenme tarihi: <strong>{formatDateTime(importRecord.createdAt)}</strong>
        </span>
        {importRecord.model && (
          <span>
            Model: <strong>{importRecord.model}</strong>
          </span>
        )}
        {importRecord.sourceType === 'JSON' ? (
          <span>
            Maliyet: <strong>Ücretsiz</strong>
          </span>
        ) : (
          importRecord.estimatedCostUsd !== null && (
            <span>
              Maliyet: <strong>{formatUsd(importRecord.estimatedCostUsd)}</strong>
            </span>
          )
        )}
      </div>

      {importRecord.status === 'FAILED' && (
        <ErrorState
          title="Çıkarım başarısız oldu."
          description={importRecord.errorMessage ?? 'Bilinmeyen bir hata oluştu.'}
        />
      )}

      <div className="ui-metric-grid">
        <MetricCard label="Yeni Oturum" value={sessionsByStatus.NEW ?? 0} />
        <MetricCard label="Geçersiz Oturum" value={sessionsByStatus.INVALID ?? 0} />
        <MetricCard label="Çıkarılan Oturum" value={sessionsByStatus.EXCLUDED ?? 0} />
        <MetricCard label="Sunum" value={summary.presentationCount} />
        <MetricCard label={MATCH_STATUS_LABELS.MATCHED} value={rolesByMatchStatus.MATCHED ?? 0} />
        <MetricCard label={MATCH_STATUS_LABELS.AMBIGUOUS} value={rolesByMatchStatus.AMBIGUOUS ?? 0} />
        <MetricCard label={MATCH_STATUS_LABELS.UNMATCHED} value={rolesByMatchStatus.UNMATCHED ?? 0} />
      </div>

      <ImportPreviewBoard
        importId={id}
        sessions={sessions}
        halls={halls}
        editable={importRecord.status === 'DRAFT'}
      />

      {total > pageSize && (
        <div className="import-pagination">
          <span>
            {total} oturum · sayfa {currentPage}/{totalPages}
          </span>
          <div className="import-pagination-buttons">
            <Link
              href={pageHref(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage <= 1}
              tabIndex={currentPage <= 1 ? -1 : undefined}
              className={currentPage <= 1 ? 'import-pagination-disabled' : undefined}
            >
              Önceki
            </Link>
            <Link
              href={pageHref(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage >= totalPages}
              tabIndex={currentPage >= totalPages ? -1 : undefined}
              className={currentPage >= totalPages ? 'import-pagination-disabled' : undefined}
            >
              Sonraki
            </Link>
          </div>
        </div>
      )}

      {importRecord.status === 'DRAFT' && summary.hallsToCreate.length > 0 && (
        <HallsToCreatePanel importId={id} hallNames={summary.hallsToCreate} />
      )}

      {(importRecord.status === 'DRAFT' ||
        importRecord.status === 'APPROVED' ||
        importRecord.status === 'CANCELLED') && (
        <ApprovePanel
          importId={id}
          congressId={congressId}
          status={importRecord.status}
          toProcess={toProcess}
          toSkip={toSkip}
          existingSessionsCount={existingSessionsCount}
        />
      )}
    </main>
  );
}
