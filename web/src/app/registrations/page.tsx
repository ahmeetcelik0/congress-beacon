import Link from 'next/link';
import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { RegistrationsBoard } from './registrations-board';
import { ImportTemplateLink } from './import-template-link';
import { ImportUploadForm } from './import-upload-form';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';
import { formatIstanbulDateTimeWithYear as formatDateTime } from '@/lib/congress-time';
import type { RegistrationImportStatus } from '@/lib/api';
import './registrations.css';

const IMPORT_STATUS_LABELS: Record<RegistrationImportStatus, string> = {
  DRAFT: 'Onay bekliyor',
  APPROVED: 'Onaylandı',
  CANCELLED: 'İptal edildi',
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Katılımcılar" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const imports = congressId ? await api.listRegistrationImports(congressId) : [];

  return (
    <main className="panel-page">
      <PageHeader
        title="Katılımcılar"
        description="Kongreye kayıtlı katılımcıları yönetin; e-posta/telefon bilgisi olmayan
          katılımcılar giriş kodu isteyemez."
        actions={
          <CongressSelector congresses={congresses} selectedId={congressId} basePath="/registrations" />
        }
      />

      {!congressId && <EmptyState title="Katılımcıları görmek için bir kongre seçin." />}

      {congressId && (
        <>
          <div className="reg-toolbar">
            <ImportTemplateLink />
            <ImportUploadForm congressId={congressId} />
          </div>

          <RegistrationsBoard congressId={congressId} />

          <section className="reg-imports-section" aria-labelledby="reg-imports-heading">
            <h2 id="reg-imports-heading">İçe Aktarma Geçmişi</h2>
            {imports.length === 0 ? (
              <EmptyState
                title="Bu kongrede henüz Excel/CSV yüklemesi yapılmadı."
                description="Yukarıdaki 'Yükle' düğmesiyle bir dosya seçtiğinizde burada listelenir."
              />
            ) : (
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Dosya</th>
                    <th>Durum</th>
                    <th>Satır Sayısı</th>
                    <th>Yükleyen</th>
                    <th>Tarih</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {imports.map((item) => (
                    <tr key={item.id}>
                      <td>{item.fileName}</td>
                      <td>
                        <StatusBadge
                          tone={
                            item.status === 'APPROVED'
                              ? 'positive'
                              : item.status === 'CANCELLED'
                                ? 'neutral'
                                : 'warning'
                          }
                        >
                          {IMPORT_STATUS_LABELS[item.status]}
                        </StatusBadge>
                      </td>
                      <td>{item.totalRows.toLocaleString('tr-TR')}</td>
                      <td>{item.adminUser.name}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>
                        <Link href={`/registrations/imports/${item.id}?congressId=${congressId}`}>
                          Görüntüle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}
