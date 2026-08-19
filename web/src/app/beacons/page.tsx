import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { BeaconForm } from './beacon-form';
import { HallSelector } from './hall-selector';
import { AssignToggle } from './assign-toggle';
import { deleteBeaconAction } from './actions';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadCongresses } from '@/lib/load-congresses';

export default async function BeaconsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string; hallId?: string }>;
}) {
  const { congressId, hallId } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Beacon'lar" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const selectedCongress = congressId
    ? congresses.find((congress) => congress.id === congressId)
    : undefined;
  const halls = congressId ? await api.listHalls(congressId) : [];
  const beacons = congressId ? await api.listBeacons(congressId) : [];
  const activeAssignments = hallId ? await api.listActiveHallBeacons(hallId) : [];
  const assignedBeaconIds = new Set(activeAssignments.map((assignment) => assignment.beaconId));

  return (
    <main className="panel-page">
      <PageHeader
        title="Beacon'lar"
        actions={
          <CongressSelector congresses={congresses} selectedId={congressId} basePath="/beacons" />
        }
      />

      {!congressId && <EmptyState title="Beacon'ları görmek için bir kongre seçin." />}

      {congressId && (
        <>
          {/* `key={congressId}` kongre değiştirildiğinde (aynı route içinde
              istemci-taraflı geçiş, bkz. `CongressSelector`) bileşeni yeniden
              mount eder ki `uuid` iç state'i YENİ kongrenin `beaconUuid`
              değerine sıfırlansın; aksi halde React eski state'i korur ve
              alan bir önceki kongrenin UUID'sini gösterir (bkz.
              `attendance/page.tsx`daki aynı desen). */}
          <BeaconForm
            key={congressId}
            congressId={congressId}
            congressBeaconUuid={selectedCongress?.beaconUuid ?? ''}
          />

          <HallSelector halls={halls} selectedId={hallId} congressId={congressId} />
          {!hallId && (
            <p>Beacon&apos;ları bir salona atamak için yukarıdan bir salon seçin.</p>
          )}

          <table className="panel-table">
            <thead>
              <tr>
                <th>UUID</th>
                <th>Major</th>
                <th>Minor</th>
                <th>Etiket</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {beacons.map((beacon) => {
                const beaconUuidMismatch =
                  !!selectedCongress?.beaconUuid &&
                  beacon.uuid.toUpperCase() !== selectedCongress.beaconUuid.toUpperCase();
                return (
                <tr key={beacon.id}>
                  <td>
                    {beacon.uuid}
                    {beaconUuidMismatch && (
                      <StatusBadge tone="critical" className="beacon-uuid-mismatch-badge">
                        UUID uyuşmuyor
                      </StatusBadge>
                    )}
                  </td>
                  <td>{beacon.major}</td>
                  <td>{beacon.minor}</td>
                  <td>{beacon.label ?? '-'}</td>
                  <td>
                    {hallId && (
                      <AssignToggle
                        hallId={hallId}
                        beaconId={beacon.id}
                        isAssigned={assignedBeaconIds.has(beacon.id)}
                      />
                    )}
                  </td>
                  <td>
                    <form action={deleteBeaconAction.bind(null, beacon.id)}>
                      <button type="submit">Sil</button>
                    </form>
                  </td>
                </tr>
                );
              })}
              {beacons.length === 0 && (
                <tr>
                  <td colSpan={6}>Bu kongrede henüz beacon yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
