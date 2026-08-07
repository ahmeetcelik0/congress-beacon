'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  api,
  type ProgramRoleCandidate,
  type ProgramRoleMatch,
  type ProgramRoleMatchesPage,
  type RematchSummary,
  type RoleMatchStatus,
} from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { MATCH_STATUS_LABELS, MATCH_STATUS_TONES, ROLE_TYPE_LABELS } from '../role-status';
import { ignoreProgramRoleAction, linkProgramRoleAction, rematchProgramRolesAction } from './actions';
import './matches.css';

const PAGE_SIZE = 20;
const ALL_VALUE = 'all';

const STATUS_OPTIONS: { value: RoleMatchStatus | typeof ALL_VALUE; label: string }[] = [
  { value: ALL_VALUE, label: 'Tüm durumlar' },
  { value: 'MATCHED', label: 'Eşleşti' },
  { value: 'AMBIGUOUS', label: 'Belirsiz' },
  { value: 'UNMATCHED', label: 'Eşleşmedi' },
  { value: 'MANUAL', label: 'Elle Bağlandı' },
  { value: 'IGNORED', label: 'Yok Sayıldı' },
];

function parentLabel(item: ProgramRoleMatch): string {
  if (item.presentation) {
    return `${item.presentation.title} — ${item.presentation.session.title}`;
  }
  if (item.session) {
    return item.session.title;
  }
  return '—';
}

function candidateContact(candidate: ProgramRoleCandidate): string | null {
  return candidate.email ?? candidate.phone ?? candidate.phoneRaw;
}

function MatchRow({ item, onChanged }: { item: ProgramRoleMatch; onChanged: () => void }) {
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [candidates, setCandidates] = useState<ProgramRoleCandidate[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [actionPending, startActionTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const candidatesPanelId = `matches-candidates-${item.id}`;

  const canPickCandidate = item.matchStatus === 'AMBIGUOUS' || item.matchStatus === 'UNMATCHED';

  function handleToggleCandidates() {
    if (candidatesOpen) {
      setCandidatesOpen(false);
      return;
    }
    setCandidatesOpen(true);
    if (candidates !== null) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    api
      .getProgramRoleCandidates(item.id)
      .then((result) => setCandidates(result))
      .catch(() => setCandidatesError('Aday listesi alınamadı.'))
      .finally(() => setCandidatesLoading(false));
  }

  function handleLink(userId: string) {
    setActionError(null);
    startActionTransition(async () => {
      const result = await linkProgramRoleAction(item.id, userId);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setCandidatesOpen(false);
      onChanged();
    });
  }

  function handleIgnore() {
    setActionError(null);
    startActionTransition(async () => {
      const result = await ignoreProgramRoleAction(item.id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      onChanged();
    });
  }

  return (
    <tr>
      <td>
        <p className="matches-cell-name">{item.rawName}</p>
        <p className="matches-cell-subtitle">{ROLE_TYPE_LABELS[item.type]}</p>
      </td>
      <td>{parentLabel(item)}</td>
      <td>
        <StatusBadge tone={MATCH_STATUS_TONES[item.matchStatus]}>
          {MATCH_STATUS_LABELS[item.matchStatus]}
        </StatusBadge>
      </td>
      <td>{item.user ? `${item.user.firstName} ${item.user.lastName}` : '—'}</td>
      <td className="matches-row-actions">
        <div className="matches-row-buttons">
          {canPickCandidate && (
            <button
              type="button"
              onClick={handleToggleCandidates}
              disabled={actionPending}
              aria-expanded={candidatesOpen}
              aria-controls={candidatesPanelId}
            >
              {candidatesOpen ? 'Adayları gizle' : 'Adayları göster'}
            </button>
          )}
          {item.matchStatus !== 'IGNORED' && (
            <button type="button" onClick={handleIgnore} disabled={actionPending}>
              {actionPending ? 'İşleniyor…' : 'Katılımcı değil'}
            </button>
          )}
        </div>
        {actionError && (
          <p className="panel-error matches-row-error" role="alert">
            {actionError}
          </p>
        )}
        {candidatesOpen && (
          <div className="matches-candidates" id={candidatesPanelId}>
            {candidatesLoading && <p className="matches-candidates-hint">Yükleniyor…</p>}
            {candidatesError && (
              <p className="panel-error" role="alert">
                {candidatesError}
              </p>
            )}
            {candidates && candidates.length === 0 && !candidatesLoading && (
              <p className="matches-candidates-hint">Aday bulunamadı.</p>
            )}
            {candidates && candidates.length > 0 && (
              <ul className="matches-candidate-list">
                {candidates.map((candidate) => {
                  const contact = candidateContact(candidate);
                  return (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => handleLink(candidate.id)}
                        disabled={actionPending}
                      >
                        {candidate.firstName} {candidate.lastName}
                        {contact && <span className="matches-candidate-contact"> · {contact}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * Client-fetch mimarisi (bkz. `registrations-table.tsx` ile AYNI desen):
 * arama/filtre URL'de KALICI olmasın istendiği için `page.tsx` SADECE
 * PageHeader + kongre seçici render eder, gerçek liste burada tarayıcıdan
 * doğrudan çekilir. Mutasyonlar (link/ignore/rematch) `'use server'`
 * eylemleri üzerinden çağrılır (ApiError mesajını tutarlı göstermek için)
 * ama `revalidatePath` bu bileşenin state'ini YENİLEMEZ - başarılı her
 * mutasyondan sonra kendi `tick` sayacı artırılır (bkz. proje tasarım
 * sistemi notu).
 */
export function MatchesTable({ congressId }: { congressId: string }) {
  const [statusFilter, setStatusFilter] = useState<RoleMatchStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProgramRoleMatchesPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [rematchPending, startRematchTransition] = useTransition();
  const [rematchError, setRematchError] = useState<string | null>(null);
  const [rematchSummary, setRematchSummary] = useState<RematchSummary | null>(null);

  const bump = useCallback(() => setTick((value) => value + 1), []);

  function handleStatusChange(value: string) {
    setStatusFilter(value as RoleMatchStatus | typeof ALL_VALUE);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .listProgramRoleMatches({
        congressId,
        status: statusFilter === ALL_VALUE ? undefined : statusFilter,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError((previous) => previous ?? 'Eşleşme listesi alınamadı.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [congressId, statusFilter, page, tick]);

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1),
    [data],
  );

  function handleRematch() {
    setRematchError(null);
    setRematchSummary(null);
    startRematchTransition(async () => {
      const result = await rematchProgramRolesAction(congressId);
      if (result.error) {
        setRematchError(result.error);
        return;
      }
      setRematchSummary(result.summary);
      bump();
    });
  }

  if (data === null && error) {
    return (
      <ErrorState
        title="Eşleşme listesi yüklenemedi."
        description={error}
        action={
          <button type="button" onClick={bump}>
            Yeniden dene
          </button>
        }
      />
    );
  }

  return (
    <div>
      <div className="matches-rematch-panel">
        <div className="matches-rematch-row">
          <button type="button" onClick={handleRematch} disabled={rematchPending}>
            {rematchPending ? 'Yeniden eşleştiriliyor…' : 'Yeniden Eşleştir'}
          </button>
          <p className="matches-rematch-hint">
            &quot;Elle Bağlandı&quot; ve &quot;Yok Sayıldı&quot; olarak işaretlenmiş kayıtlara
            DOKUNULMAZ; yalnızca diğer roller (özellikle katılımcı listesi sonradan güncellendiği için
            artık eşleşebilecek &quot;Eşleşmedi&quot; kayıtları) yeniden hesaplanır.
          </p>
        </div>
        {rematchError && (
          <p className="panel-error" role="alert">
            {rematchError}
          </p>
        )}
        {rematchSummary && (
          <p className="matches-rematch-summary" role="status">
            Tamamlandı: {rematchSummary.matched} eşleşti · {rematchSummary.ambiguous} belirsiz ·{' '}
            {rematchSummary.unmatched} eşleşmedi · {rematchSummary.skipped} değişmedi (elle bağlı/yok
            sayılan).
          </p>
        )}
      </div>

      {error && data !== null && (
        <div className="matches-stale-banner" role="status">
          Liste güncellenemedi, önceki veri gösteriliyor.
        </div>
      )}

      <div className="matches-filters">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger aria-label="Eşleşme durumu filtresi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button type="button" onClick={bump}>
          Yenile
        </button>
      </div>

      {data && data.items.length === 0 ? (
        <EmptyState title="Bu filtreye uyan rol bulunamadı." />
      ) : (
        <table className="panel-table matches-table">
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '25%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Rol</th>
              <th>Oturum / Sunum</th>
              <th>Durum</th>
              <th>Eşleşen Katılımcı</th>
              <th>Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            {data === null && !error && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                  Yükleniyor…
                </td>
              </tr>
            )}
            {data?.items.map((item) => (
              <MatchRow key={item.id} item={item} onChanged={bump} />
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <div className="matches-pagination">
          <span>
            {data.total} kayıt · sayfa {page}/{totalPages}
          </span>
          <div className="matches-pagination-buttons">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Önceki
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
