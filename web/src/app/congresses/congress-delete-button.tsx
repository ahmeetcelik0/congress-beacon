'use client';

import * as React from 'react';
import { deleteCongressAction } from './actions';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';

/**
 * Kart üzerindeki "Sil" eylemi: `deleteCongressAction`'ı `<form action>`
 * ÜZERİNDEN DEĞİL, doğrudan bir `startTransition` içinde çağırır — bu sayede
 * hata dönerse dialog KAPANMADAN içinde gösterilebilir (bkz. `actions.ts`
 * yorumu). Başarılı silmede `revalidatePath('/congresses')` zaten sunucu
 * bileşenlerini tazeliyor; kart listesi bir sonraki render'da kaybolur.
 */
export function CongressDeleteButton({
  congressId,
  congressName,
}: {
  congressId: string;
  congressName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCongressAction(congressId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleCancel() {
    if (isPending) return;
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        className="congress-card-action congress-card-action-danger"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Sil
      </button>
      <ConfirmDeleteDialog
        open={open}
        title="Kongreyi sil"
        description={
          <>
            <strong>{congressName}</strong> kongresini silmek üzeresiniz. Bu işlem geri
            alınamaz; bu kongreye bağlı salon, beacon ve katılım verileri etkilenebilir.
          </>
        }
        confirmLabel="Kongreyi sil"
        cancelLabel="İptal"
        pending={isPending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
