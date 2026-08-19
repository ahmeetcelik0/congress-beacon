import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { loadContentList } from '../load-content-list';
import { SponsorForm } from './sponsor-form';
import { SponsorsTable } from './sponsors-table';

export async function SponsorsSection({ congressId }: { congressId: string }) {
  const result = await loadContentList(() => api.listSponsors(congressId));

  if (!result.ok) {
    return (
      <section aria-labelledby="content-sponsors-heading">
        <h2 id="content-sponsors-heading">Sponsorlar</h2>
        <ErrorState title="Sponsor listesi yüklenemedi." description={result.message} />
      </section>
    );
  }

  const items = result.items;

  return (
    <section aria-labelledby="content-sponsors-heading">
      <h2 id="content-sponsors-heading">Sponsorlar</h2>
      <p className="content-section-hint">
        Kademeye göre (Platin → Destekçi) sıralı listelenir; aynı kademe içinde görüntülenme sırası
        oklarla değiştirilebilir.
      </p>
      <SponsorForm congressId={congressId} />
      {items.length === 0 ? (
        <EmptyState
          title="Bu kongrede henüz sponsor yok."
          description="Yukarıdaki formla ilk sponsoru ekleyin."
        />
      ) : (
        <SponsorsTable items={items} congressId={congressId} />
      )}
    </section>
  );
}
