'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { Sponsor } from '@/lib/api';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { SponsorRow } from './sponsor-row';
import { deleteSponsorAction } from './actions';

/**
 * Liste backend'den ONCE tier SONRA displayOrder'a gore sirali gelir (bkz.
 * api.ts yorumu). Sıralama okları BASİT tutuldu: tier gruplaması olmadan
 * TEK düz liste üzerinde çalışır (görev tanımının izin verdiği basitleştirme)
 * — bir sponsoru yukarı/aşağı taşımak listenin GENELİNDEKİ (tier sınırını
 * aşabilen) komşusuyla yer değiştirir.
 */
export function SponsorsTable({ items, congressId }: { items: Sponsor[]; congressId: string }) {
  const [deleteTarget, setDeleteTarget] = React.useState<Sponsor | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteSponsorAction(deleteTarget.id);
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
            <th>Logo</th>
            <th>Sponsor</th>
            <th>Kademe</th>
            <th>Aksiyonlar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <SponsorRow
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
        title="Sponsoru sil"
        description={
          deleteTarget && (
            <>
              <strong>{deleteTarget.name}</strong> sponsorunu silmek üzeresiniz. Bu işlem geri
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
