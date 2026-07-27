import { CongressForm } from './congress-form';
import { CongressCard } from './congress-card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';
import { getCongressStatus, sortCongressesByStatus } from '@/lib/congress-status';

function buildDescription(total: number, activeCount: number, upcomingCount: number): string {
  const base = 'Kongre oluşturun; salon ve beacon yönetimine buradan geçin.';
  if (total === 0) return base;

  const parts = [`${total} kongre`];
  if (activeCount > 0) parts.push(`${activeCount} aktif`);
  if (upcomingCount > 0) parts.push(`${upcomingCount} yaklaşan`);
  return `${base} Toplam ${parts.join(', ')}.`;
}

export default async function CongressesPage() {
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader
          title="Kongreler"
          description="Kongre oluşturun; salon ve beacon yönetimine buradan geçin."
        />
        <CongressLoadError />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const now = new Date();
  const activeCount = congresses.filter((c) => getCongressStatus(c, now).key === 'active').length;
  const upcomingCount = congresses.filter(
    (c) => getCongressStatus(c, now).key === 'upcoming',
  ).length;
  const sortedCongresses = sortCongressesByStatus(congresses, now);

  return (
    <main className="panel-page">
      <PageHeader
        title="Kongreler"
        description={buildDescription(congresses.length, activeCount, upcomingCount)}
      />

      <CongressForm />

      {sortedCongresses.length === 0 ? (
        <EmptyState
          title="Henüz kongre yok."
          description="Yukarıdaki formu kullanarak ilk kongrenizi oluşturun; oluşturduktan sonra salon ve beacon tanımlarına buradan devam edebilirsiniz."
        />
      ) : (
        <div className="congress-card-grid">
          {sortedCongresses.map((congress) => (
            <CongressCard
              key={congress.id}
              congress={congress}
              status={getCongressStatus(congress, now)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
