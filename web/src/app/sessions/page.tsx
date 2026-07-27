import { api } from '@/lib/api';
import { CongressSelector } from '../components/congress-selector';
import { SessionForm } from './session-form';
import { deleteSessionAction } from './actions';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';

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
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Bilimsel Program" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const halls = congressId ? await api.listHalls(congressId) : [];
  const sessions = congressId ? await api.listSessions(congressId) : [];

  return (
    <main className="panel-page">
      <PageHeader
        title="Bilimsel Program"
        actions={
          <CongressSelector congresses={congresses} selectedId={congressId} basePath="/sessions" />
        }
      />

      {!congressId && <EmptyState title="Oturumları görmek için bir kongre seçin." />}

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
