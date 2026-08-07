'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { CongressInfoSection } from '@/lib/api';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { InfoSectionRow } from './info-section-row';
import { deleteInfoSectionAction } from './actions';

export function InfoSectionsTable({ items }: { items: CongressInfoSection[] }) {
  const [deleteTarget, setDeleteTarget] = React.useState<CongressInfoSection | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteInfoSectionAction(deleteTarget.id);
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
            <th>Başlık</th>
            <th>Durum</th>
            <th>Aksiyonlar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <InfoSectionRow
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
        title="Bilgi bölümünü sil"
        description={
          deleteTarget && (
            <>
              <strong>{deleteTarget.title}</strong> bilgi bölümünü silmek üzeresiniz. Bu işlem geri
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
