import Link from 'next/link';
import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { HallForm } from './hall-form';
import { deleteHallAction, updateHallRssiAction } from './actions';

export default async function HallsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congresses = await api.listCongresses();
  const halls = congressId ? await api.listHalls(congressId) : [];

  return (
    <main className="panel-page">
      <h1>Salonlar</h1>
      <CongressSelector congresses={congresses} selectedId={congressId} basePath="/halls" />

      {!congressId && <p>Salonları görmek için bir kongre seçin.</p>}

      {congressId && (
        <>
          <HallForm congressId={congressId} />
          <table className="panel-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>RSSI Eşiği</th>
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
                  <td colSpan={4}>Bu kongrede henüz salon yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
