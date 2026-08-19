import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { loadContentList } from '../load-content-list';
import { VenueForm } from './venue-form';
import { VenuesTable } from './venues-table';

export async function VenuesSection({ congressId }: { congressId: string }) {
  const result = await loadContentList(() => api.listVenues(congressId));

  if (!result.ok) {
    return (
      <section aria-labelledby="content-venues-heading">
        <h2 id="content-venues-heading">Mekanlar</h2>
        <ErrorState title="Mekan listesi yüklenemedi." description={result.message} />
      </section>
    );
  }

  const items = result.items;

  return (
    <section aria-labelledby="content-venues-heading">
      <h2 id="content-venues-heading">Mekanlar</h2>
      <p className="content-section-hint">
        Kongre merkezi ve anlaşmalı otel/mekan bilgileri — mobil uygulamada ulaşım ve konaklama
        bölümünde gösterilir.
      </p>
      <VenueForm congressId={congressId} />
      {items.length === 0 ? (
        <EmptyState
          title="Bu kongrede henüz mekan tanımlı değil."
          description="Yukarıdaki formla ilk mekanı (ör. kongre merkezi) ekleyin."
        />
      ) : (
        <VenuesTable items={items} congressId={congressId} />
      )}
    </section>
  );
}
