'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { Hall, Session } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { SessionForm } from './session-form';
import { SessionCard } from './session-card';
import { deleteSessionAction } from './session-actions';
import { deletePresentationAction } from './presentation-actions';
import { deleteRoleAction } from './role-actions';
import type { DeleteTarget } from './delete-target';

const ALL_VALUE = 'all';

const DELETE_COPY: Record<DeleteTarget['kind'], { title: string; note: string }> = {
  session: {
    title: 'Oturumu sil',
    note: 'Bu oturuma bağlı tüm sunumlar ve roller de silinir. Bu işlem geri alınamaz.',
  },
  presentation: {
    title: 'Sunumu sil',
    note: 'Bu sunuma bağlı tüm konuşmacı/tartışmacı rolleri de silinir. Bu işlem geri alınamaz.',
  },
  role: {
    title: 'Rolü sil',
    note: 'Bu işlem geri alınamaz.',
  },
};

/**
 * Sayfa gövdesi: gün/salon filtresi (istemci tarafında, backend filtre
 * DESTEKLEMİYOR — bkz. görev tanımı) + oturum listesi + TEK paylaşılan
 * silme onay dialog'u (oturum/sunum/rol'ün üçü de buraya bubble eder,
 * `ConfirmDeleteDialog` bir kart/satır İÇİNE gömülürse geçersiz DOM/görsel
 * hataya yol açar — bkz. Faz 3 dersi).
 */
export function SessionsBoard({
  congressId,
  sessions,
  halls,
}: {
  congressId: string;
  sessions: Session[];
  halls: Hall[];
}) {
  const [dayFilter, setDayFilter] = React.useState(ALL_VALUE);
  const [hallFilter, setHallFilter] = React.useState(ALL_VALUE);

  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  // Gun etiketleri backend'den zaten `dayLabel asc` sirali geldigi icin
  // burada ekstra siralama YAPILMAZ, yalnizca ilk gorulme sirasiyla
  // tekillestirilir.
  const days = React.useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const session of sessions) {
      if (session.dayLabel && !seen.has(session.dayLabel)) {
        seen.add(session.dayLabel);
        list.push(session.dayLabel);
      }
    }
    return list;
  }, [sessions]);

  const filtered = React.useMemo(
    () =>
      sessions.filter(
        (session) =>
          (dayFilter === ALL_VALUE || session.dayLabel === dayFilter) &&
          (hallFilter === ALL_VALUE || session.hallId === hallFilter),
      ),
    [sessions, dayFilter, hallFilter],
  );

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const action =
        deleteTarget.kind === 'session'
          ? deleteSessionAction
          : deleteTarget.kind === 'presentation'
            ? deletePresentationAction
            : deleteRoleAction;
      const result = await action(deleteTarget.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setDeleteTarget(null);
    });
  }

  function handleCancelDelete() {
    if (deletePending) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  return (
    <>
      <SessionForm congressId={congressId} halls={halls} />

      <div className="sessions-filters">
        <label className="sessions-filter">
          Gün
          <Select value={dayFilter} onValueChange={setDayFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tüm günler</SelectItem>
              {days.map((day) => (
                <SelectItem key={day} value={day}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="sessions-filter">
          Salon
          <Select value={hallFilter} onValueChange={setHallFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tüm salonlar</SelectItem>
              {halls.map((hall) => (
                <SelectItem key={hall.id} value={hall.id}>
                  {hall.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span className="sessions-filter-count">
          {filtered.length} / {sessions.length} oturum gösteriliyor
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            sessions.length === 0
              ? 'Bu kongrede henüz oturum yok.'
              : 'Seçili gün/salon filtresine uyan oturum yok.'
          }
          description={
            sessions.length === 0
              ? 'Yukarıdaki formla ilk oturumu ekleyin.'
              : 'Filtreleri değiştirerek diğer oturumları görebilirsiniz.'
          }
        />
      ) : (
        <ul className="sessions-list">
          {filtered.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              items={filtered}
              index={index}
              hallName={session.hall?.name ?? halls.find((h) => h.id === session.hallId)?.name ?? '—'}
              onRequestDelete={(target) => {
                setDeleteTarget(target);
                setDeleteError(null);
              }}
            />
          ))}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={deleteTarget ? DELETE_COPY[deleteTarget.kind].title : ''}
        description={
          deleteTarget && (
            <>
              <strong>{deleteTarget.label}</strong> silinecek. {DELETE_COPY[deleteTarget.kind].note}
            </>
          )
        }
        pending={deletePending}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
