import Link from 'next/link';
import { api } from '@/lib/api';
import { CongressForm } from './congress-form';
import { deleteCongressAction } from './actions';

export default async function CongressesPage() {
  const congresses = await api.listCongresses();

  return (
    <main className="panel-page">
      <h1>Kongreler</h1>
      <CongressForm />

      <table className="panel-table">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Beacon UUID</th>
            <th>Başlangıç</th>
            <th>Bitiş</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {congresses.map((congress) => (
            <tr key={congress.id}>
              <td>
                <Link href={`/halls?congressId=${congress.id}`}>{congress.name}</Link>
              </td>
              <td>{congress.beaconUuid}</td>
              <td>{congress.startDate ?? '-'}</td>
              <td>{congress.endDate ?? '-'}</td>
              <td>
                <form action={deleteCongressAction.bind(null, congress.id)}>
                  <button type="submit">Sil</button>
                </form>
              </td>
            </tr>
          ))}
          {congresses.length === 0 && (
            <tr>
              <td colSpan={5}>Henüz kongre yok.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
