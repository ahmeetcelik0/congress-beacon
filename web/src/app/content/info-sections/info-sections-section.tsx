import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { loadContentList } from '../load-content-list';
import { InfoSectionForm } from './info-section-form';
import { InfoSectionsTable } from './info-sections-table';

export async function InfoSectionsSection({ congressId }: { congressId: string }) {
  const result = await loadContentList(() => api.listInfoSections(congressId));

  if (!result.ok) {
    return (
      <section aria-labelledby="content-info-heading">
        <h2 id="content-info-heading">Genel Bilgi Bölümleri</h2>
        <ErrorState title="Bilgi bölümleri yüklenemedi." description={result.message} />
      </section>
    );
  }

  const items = result.items;

  return (
    <section aria-labelledby="content-info-heading">
      <h2 id="content-info-heading">Genel Bilgi Bölümleri</h2>
      <p className="content-section-hint">
        Kongre hakkında serbest metin bölümleri (katılım koşulları, ulaşım, vb.) — mobil ana ekranda
        bu sırayla listelenir.
      </p>
      <InfoSectionForm congressId={congressId} />
      {items.length === 0 ? (
        <EmptyState
          title="Bu kongrede henüz bilgi bölümü yok."
          description="Yukarıdaki formla ilk bölümü ekleyin."
        />
      ) : (
        <InfoSectionsTable items={items} />
      )}
    </section>
  );
}
