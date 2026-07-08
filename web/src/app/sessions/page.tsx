import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { SessionForm } from './session-form';
import { deleteSessionAction } from './actions';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string }>;
}) {
  const { congressId } = await searchParams;
  const congresses = await api.listCongresses();
  const halls = congressId ? await api.listHalls(congressId) : [];
  const sessions = congressId ? await api.listSessions(congressId) : [];

  return (
    <main className="panel-page">
      <h1>Bilimsel Program</h1>
      <CongressSelector congresses={congresses} selectedId={congressId} basePath="/sessions" />

      {!congressId && <p>Oturumları görmek için bir kongre seçin.</p>}

      {congressId && (
        <>
          <SessionForm congressId={congressId} halls={halls} />

          <table className="panel-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Salon</th>
                <th>Konuşmacı</th>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.title}</td>
                  <td>{session.hall?.name ?? halls.find((h) => h.id === session.hallId)?.name ?? '—'}</td>
                  <td>{session.speaker ?? '—'}</td>
                  <td>{formatDateTime(session.startTime)}</td>
                  <td>{formatDateTime(session.endTime)}</td>
                  <td>
                    <form action={deleteSessionAction.bind(null, session.id)}>
                      <button type="submit">Sil</button>
                    </form>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6}>Bu kongrede henüz oturum yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
