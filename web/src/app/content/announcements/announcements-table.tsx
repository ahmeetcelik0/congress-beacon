'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { Announcement } from '@/lib/api';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { AnnouncementRow } from './announcement-row';
import { deleteAnnouncementAction } from './actions';

export function AnnouncementsTable({ items }: { items: Announcement[] }) {
  const [deleteTarget, setDeleteTarget] = React.useState<Announcement | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteAnnouncementAction(deleteTarget.id);
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
            <th>Duyuru</th>
            <th>Durum</th>
            <th>Yayın</th>
            <th>Aksiyonlar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <AnnouncementRow
              key={item.id}
              item={item}
              items={items}
              index={index}
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
        title="Duyuruyu sil"
        description={
          deleteTarget && (
            <>
              <strong>{deleteTarget.title}</strong> duyurusunu silmek üzeresiniz. Bu işlem geri
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
