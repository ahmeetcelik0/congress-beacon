import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { SessionsBoard } from './sessions-board';
import { ProgramImportPanel } from './imports/program-import-panel';
import { JsonProgramImportPanel } from './imports/json-import-panel';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';
import './sessions.css';

/**
 * Bilimsel Program — iki seviyeli model: oturum (moderatörlü) içinde birden
 * fazla sunum (konuşmacılı) olur. `GET /sessions` sunum+rol ağacını İÇ İÇE
 * döndürdüğü için burada TEK istekle tüm veri gelir (bkz. api sözleşmesi),
 * gün/salon filtresi ve genişleyen kart durumu `SessionsBoard`da (istemci)
 * yönetilir.
 */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Bilimsel Program" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const halls = congressId ? await api.listHalls(congressId) : [];
  const sessions = congressId ? await api.listSessions(congressId) : [];
  // Program dosyasi (PDF/Excel) yukleme gecmisi + kongre bazinda toplam LLM
  // harcamasi - yalnizca kongre secildiginde anlamli (bkz. `ProgramImportPanel`).
  const programImports = congressId ? await api.listProgramImports(congressId) : null;

  return (
    <main className="panel-page">
      <PageHeader
        title="Bilimsel Program"
        description="Oturumları, oturum içindeki sunumları ve moderatör/konuşmacı/tartışmacı
          rollerini yönetin. Katılımcı eşleştirme durumları için Konuşmacı Eşleşmeleri
          sayfasını kullanın."
        actions={
          <CongressSelector congresses={congresses} selectedId={congressId} basePath="/sessions" />
        }
      />

      {!congressId && <EmptyState title="Oturumları görmek için bir kongre seçin." />}

      {congressId && (
        <ProgramImportPanel
          congressId={congressId}
          totalSpendUsd={programImports?.totalSpendUsd ?? 0}
          recentImports={programImports?.imports ?? []}
        />
      )}

      {congressId && <JsonProgramImportPanel congressId={congressId} />}

      {congressId && <SessionsBoard congressId={congressId} sessions={sessions} halls={halls} />}
    </main>
  );
}
