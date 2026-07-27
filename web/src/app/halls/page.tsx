import Link from 'next/link';
import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { HallForm } from './hall-form';
import { HallCapacityControl } from './hall-capacity-control';
import { deleteHallAction, updateHallRssiAction } from './actions';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';

export default async function HallsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Salonlar" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const halls = congressId ? await api.listHalls(congressId) : [];

  return (
    <main className="panel-page">
      <PageHeader
        title="Salonlar"
        actions={
          <CongressSelector congresses={congresses} selectedId={congressId} basePath="/halls" />
        }
      />

      {!congressId && <EmptyState title="Salonları görmek için bir kongre seçin." />}

      {congressId && (
        <>
          <HallForm congressId={congressId} />
          <table className="panel-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>RSSI Eşiği</th>
                <th>Kapasite</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {halls.map((hall) => (
                <tr key={hall.id}>
                  <td>{hall.name}</td>
                  <td>
                    <form
                      action={updateHallRssiAction.bind(null, hall.id)}
                      className="panel-inline-form"
                    >
                      <input
                        type="number"
                        name="rssiThreshold"
                        defaultValue={hall.rssiThreshold}
                        min={-100}
                        max={0}
                      />
                      <button type="submit">Kaydet</button>
                    </form>
                  </td>
                  <td>
                    <div className="hall-capacity-cell">
                      {hall.capacity == null ? (
                        <StatusBadge tone="neutral">Kapasite tanımlanmadı</StatusBadge>
                      ) : (
                        <span className="hall-capacity-value">
                          {hall.capacity.toLocaleString('tr-TR')} kişi
                        </span>
                      )}
                      <HallCapacityControl hallId={hall.id} initialCapacity={hall.capacity} />
                    </div>
                  </td>
                  <td>
                    <Link href={`/beacons?congressId=${congressId}&hallId=${hall.id}`}>
                      Beacon&apos;lar
                    </Link>
                  </td>
                  <td>
                    <form action={deleteHallAction.bind(null, hall.id)}>
                      <button type="submit">Sil</button>
                    </form>
                  </td>
                </tr>
              ))}
              {halls.length === 0 && (
                <tr>
                  <td colSpan={5}>Bu kongrede henüz salon yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
