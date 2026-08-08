'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { cancelProgramImportAction } from './actions';

/**
 * `PENDING`/`EXTRACTING` "işleniyor" ekranında tek başına kullanılan iptal
 * düğmesi — `DRAFT` durumundaki tam onaylama/iptal paneli (`ApprovePanel`)
 * henüz anlamlı değildir (staging ağacı YOK), ama kullanıcı çıkarım
 * sürerken de vazgeçebilmelidir (bkz. görev tanımı).
 */
export function CancelImportButton({ importId }: { importId: string }) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelProgramImportAction(importId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" className="import-status-cancel" onClick={() => setOpen(true)}>
        Yüklemeyi İptal Et
      </button>
      <ConfirmDeleteDialog
        open={open}
        title="Yüklemeyi iptal et"
        description="Bu yükleme iptal edilecek, işlem tamamlansa bile hiçbir oturum programa işlenmeyecek. Bu işlem geri alınamaz."
        confirmLabel="Yüklemeyi iptal et"
        cancelLabel="Vazgeç"
        pending={pending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (pending) return;
          setOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
