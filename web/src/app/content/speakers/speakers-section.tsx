import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { loadContentList } from '../load-content-list';
import { SpeakerForm } from './speaker-form';
import { SpeakersTable } from './speakers-table';

export async function SpeakersSection({ congressId }: { congressId: string }) {
  const result = await loadContentList(() => api.listKeynoteSpeakers(congressId));

  if (!result.ok) {
    return (
      <section aria-labelledby="content-speakers-heading">
        <h2 id="content-speakers-heading">Ana Konuşmacılar</h2>
        <ErrorState title="Konuşmacı listesi yüklenemedi." description={result.message} />
      </section>
    );
  }

  const items = result.items;

  return (
    <section aria-labelledby="content-speakers-heading">
      <h2 id="content-speakers-heading">Ana Konuşmacılar</h2>
      <p className="content-section-hint">
        Mobil ana ekranda gösterilecek konuşmacı vitrini — Bilimsel Program (Oturumlar) sayfasındaki
        oturum konuşmacılarından BAĞIMSIZ, elle yönetilen ayrı bir listedir.
      </p>
      <SpeakerForm congressId={congressId} />
      {items.length === 0 ? (
        <EmptyState
          title="Bu kongrede henüz konuşmacı vitrini boş."
          description="Yukarıdaki formla ilk konuşmacıyı ekleyin."
        />
      ) : (
        <SpeakersTable items={items} congressId={congressId} />
      )}
    </section>
  );
}
