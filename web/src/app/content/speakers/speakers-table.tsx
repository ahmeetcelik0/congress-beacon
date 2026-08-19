'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { KeynoteSpeaker } from '@/lib/api';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { SpeakerRow } from './speaker-row';
import { deleteKeynoteSpeakerAction } from './actions';

export function SpeakersTable({ items, congressId }: { items: KeynoteSpeaker[]; congressId: string }) {
  const [deleteTarget, setDeleteTarget] = React.useState<KeynoteSpeaker | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteKeynoteSpeakerAction(deleteTarget.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setDeleteTarget(null);
    });
  }

  return (
    <>
      <table className="panel-table content-table">
        <thead>
          <tr>
            <th>Sıra</th>
            <th>Fotoğraf</th>
            <th>Konuşmacı</th>
            <th>Aksiyonlar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <SpeakerRow
              key={item.id}
              item={item}
              items={items}
              index={index}
              congressId={congressId}
              onRequestDelete={(target) => {
                setDeleteTarget(target);
                setDeleteError(null);
              }}
            />
          ))}
        </tbody>
      </table>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Konuşmacıyı sil"
        description={
          deleteTarget && (
            <>
              <strong>{deleteTarget.fullName}</strong> konuşmacısını silmek üzeresiniz. Bu işlem geri
              alınamaz.
            </>
          )
        }
        pending={deletePending}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (deletePending) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </>
  );
}
