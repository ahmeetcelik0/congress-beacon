'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { Hall, ProgramImportSession } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { AddSessionForm } from './add-session-form';
import { SessionRow } from './session-row';
import {
  deleteProgramImportPresentationAction,
  deleteProgramImportRoleAction,
  excludeProgramImportSessionAction,
} from './actions';
import type { DeleteTarget } from './delete-target';

const DELETE_COPY: Record<DeleteTarget['kind'], { title: string; note: string; confirmLabel: string }> = {
  session: {
    title: 'Oturumu çıkar',
    note:
      'Bu oturum panelden ÇIKARILACAK (kalıcı silme değil) ve onaylama sırasında atlanacak. Bu işlem geri alınamaz — çıkarılan bir oturum yeniden dahil edilemez.',
    confirmLabel: 'Çıkar',
  },
  presentation: {
    title: 'Sunumu sil',
    note: 'Bu sunuma bağlı tüm roller de KALICI olarak silinir. Bu işlem geri alınamaz.',
    confirmLabel: 'Sil',
  },
  role: {
    title: 'Rolü sil',
    note: 'Bu işlem geri alınamaz.',
    confirmLabel: 'Sil',
  },
};

/**
 * Sayfa gövdesi: elle oturum ekleme formu + staging oturum listesi + TEK
 * paylaşılan silme/çıkarma onay dialog'u (oturum/sunum/rol'ün üçü de buraya
 * bubble eder — `/sessions`teki `SessionsBoard` ile AYNI mimari desen, bkz.
 * proje tasarım sistemi notu: "derinlemesine iç içe CRUD + TEK paylaşılan
 * ConfirmDeleteDialog").
 */
export function ImportPreviewBoard({
  importId,
  sessions,
  halls,
  editable,
}: {
  importId: string;
  sessions: ProgramImportSession[];
  halls: Hall[];
  editable: boolean;
}) {
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result =
        deleteTarget.kind === 'session'
          ? await excludeProgramImportSessionAction(importId, deleteTarget.id)
          : deleteTarget.kind === 'presentation'
            ? await deleteProgramImportPresentationAction(importId, deleteTarget.id)
            : await deleteProgramImportRoleAction(importId, deleteTarget.id);
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
      {editable && <AddSessionForm importId={importId} halls={halls} />}

      {sessions.length === 0 ? (
        <EmptyState title="Bu sayfada gösterilecek oturum yok." />
      ) : (
        <ul className="sessions-list import-session-list">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              importId={importId}
              session={session}
              halls={halls}
              editable={editable}
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
        confirmLabel={deleteTarget ? DELETE_COPY[deleteTarget.kind].confirmLabel : undefined}
        description={
          deleteTarget && (
            <>
              <strong>{deleteTarget.label}</strong> {DELETE_COPY[deleteTarget.kind].note}
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
