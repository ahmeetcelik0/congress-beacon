import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { TrackingHealthView } from './tracking-health-view';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';
import './tracking-health.css';

export default async function TrackingHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Takip Sağlığı" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const data = congressId ? await api.getTrackingHealth(congressId) : null;

  return (
    <main className="panel-page">
      <PageHeader
        title="Takip Sağlığı"
        actions={
          <CongressSelector
            congresses={congresses}
            selectedId={congressId}
            basePath="/tracking-health"
          />
        }
      />

      {!congressId && <EmptyState title="Takip sağlığını görmek için bir kongre seçin." />}

      {congressId && data && <TrackingHealthView congressId={congressId} initialData={data} />}
    </main>
  );
}
