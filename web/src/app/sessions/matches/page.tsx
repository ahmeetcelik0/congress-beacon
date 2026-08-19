import { CongressSelector } from '../../components/congress-selector';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';
import { MatchesTable } from './matches-table';
import { UnmatchedNamesPanel } from './unmatched-names-panel';

/**
 * Konuşmacı Eşleşmeleri — bilimsel programdaki moderatör/konuşmacı/tartışmacı
 * isimlerinin katılımcı listesiyle otomatik (isim üzerinden) eşleştirme
 * durumunu gösterir ve belirsiz/eşleşmeyen kayıtlar için elle bağlama sağlar.
 * Liste `MatchesTable` içinde client-fetch ile çekilir (arama/sayfalama URL'de
 * kalıcı olmasın istendiği için, bkz. `registrations-table.tsx` ile aynı
 * mimari) — bu sayfa yalnızca kongre seçimini SSR'da okur.
 */
export default async function ProgramRoleMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Konuşmacı Eşleşmeleri" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;

  return (
    <main className="panel-page">
      <PageHeader
        title="Konuşmacı Eşleşmeleri"
        description="Bilimsel programdaki moderatör/konuşmacı/tartışmacı isimlerinin katılımcı
          listesiyle eşleşme durumunu inceleyin; belirsiz veya eşleşmeyen kayıtları elle bağlayın."
        actions={
          <CongressSelector
            congresses={congresses}
            selectedId={congressId}
            basePath="/sessions/matches"
          />
        }
      />

      {!congressId && <EmptyState title="Eşleşmeleri görmek için bir kongre seçin." />}

      {congressId && <UnmatchedNamesPanel congressId={congressId} />}

      {congressId && <MatchesTable congressId={congressId} />}
    </main>
  );
}
