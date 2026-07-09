import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { TrackingHealthView } from './tracking-health-view';
import './tracking-health.css';

export default async function TrackingHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congresses = await api.listCongresses();
  const data = congressId ? await api.getTrackingHealth(congressId) : null;

  return (
    <main className="panel-page">
      <h1>Takip Sağlığı</h1>
      <CongressSelector congresses={congresses} selectedId={congressId} basePath="/tracking-health" />

      {!congressId && <p>Takip sağlığını görmek için bir kongre seçin.</p>}

      {congressId && data && <TrackingHealthView congressId={congressId} initialData={data} />}
    </main>
  );
}
