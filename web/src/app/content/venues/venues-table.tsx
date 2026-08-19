'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { Venue } from '@/lib/api';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { VenueRow } from './venue-row';
import { deleteVenueAction } from './actions';

export function VenuesTable({ items, congressId }: { items: Venue[]; congressId: string }) {
  const [deleteTarget, setDeleteTarget] = React.useState<Venue | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteVenueAction(deleteTarget.id);
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
            <th>Görsel</th>
            <th>Mekan</th>
            <th>Tür</th>
            <th>Aksiyonlar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <VenueRow
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
        title="Mekanı sil"
        description={
          deleteTarget && (
            <>
              <strong>{deleteTarget.name}</strong> mekanını silmek üzeresiniz. Bu işlem geri alınamaz.
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
