import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { BeaconForm } from './beacon-form';
import { HallSelector } from './hall-selector';
import { AssignToggle } from './assign-toggle';
import { deleteBeaconAction } from './actions';

export default async function BeaconsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string; hallId?: string }>;
}) {
  const { congressId, hallId } = await searchParams;
  const congresses = await api.listCongresses();
  const halls = congressId ? await api.listHalls(congressId) : [];
  const beacons = congressId ? await api.listBeacons(congressId) : [];
  const activeAssignments = hallId ? await api.listActiveHallBeacons(hallId) : [];
  const assignedBeaconIds = new Set(activeAssignments.map((assignment) => assignment.beaconId));

  return (
    <main className="panel-page">
      <h1>Beacon&apos;lar</h1>
      <CongressSelector congresses={congresses} selectedId={congressId} basePath="/beacons" />

      {!congressId && <p>Beacon&apos;ları görmek için bir kongre seçin.</p>}

      {congressId && (
        <>
          <BeaconForm congressId={congressId} />

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
              {beacons.map((beacon) => (
                <tr key={beacon.id}>
                  <td>{beacon.uuid}</td>
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
              ))}
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
