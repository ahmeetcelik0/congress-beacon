import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { loadContentList } from '../load-content-list';
import { AnnouncementForm } from './announcement-form';
import { AnnouncementsTable } from './announcements-table';

export async function AnnouncementsSection({ congressId }: { congressId: string }) {
  const result = await loadContentList(() => api.listAnnouncements(congressId));

  if (!result.ok) {
    return (
      <section aria-labelledby="content-announcements-heading">
        <h2 id="content-announcements-heading">Duyurular</h2>
        <ErrorState title="Duyuru listesi yüklenemedi." description={result.message} />
      </section>
    );
  }

  const items = result.items;

  return (
    <section aria-labelledby="content-announcements-heading">
      <h2 id="content-announcements-heading">Duyurular</h2>
      <p className="content-section-hint">
        Sabitlenmiş duyurular en üstte, diğerleri en son yayınlanan önde olacak şekilde listelenir.
        Yeni duyurular taslak olarak eklenir.
      </p>
      <AnnouncementForm congressId={congressId} />
      {items.length === 0 ? (
        <EmptyState
          title="Bu kongrede henüz duyuru yok."
          description="Yukarıdaki formla ilk duyuruyu ekleyin."
        />
      ) : (
        <AnnouncementsTable items={items} />
      )}
    </section>
  );
}
