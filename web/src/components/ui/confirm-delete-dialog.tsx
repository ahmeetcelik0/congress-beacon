'use client';

import * as React from 'react';
import './confirm-delete-dialog.css';

/**
 * Yıkıcı (geri alınamaz) silme işlemleri için tek tip onay dialog'u.
 * Native `<dialog>` + `showModal()` kullanılır: tarayıcı bunun için
 * kendiliğinden odak tuzağı (Tab/Shift+Tab dialog içinde kalır), `::backdrop`
 * ve kapanışta önceki odağa (tetikleyici butona) dönüş sağlar — ayrı bir
 * modal/focus-trap kütüphanesi eklemeye gerek bırakmaz.
 *
 * Backdrop tıklama kararı: dialog'un kendi kutusu dışına (yani `::backdrop`
 * alanına) tıklamak `onCancel`'i tetikler. Bu güvenlidir çünkü backdrop
 * tıklaması asla `onConfirm`'i (yıkıcı eylemi) TETİKLEMEZ, yalnızca iptal
 * eder — kazara dışarı tıklama en kötü ihtimalle dialog'u kapatır, veri
 * silmez. Silme sürerken (`pending`) hem backdrop hem Escape kapatmayı
 * YOK SAYAR ki kullanıcı sonucu/hatayı görmeden dialog kaybolmasın.
 */
export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Sil',
  cancelLabel = 'İptal',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="ui-confirm-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Escape tuşu: silme devam ederken kapanmayı engelle.
        if (pending) {
          event.preventDefault();
        }
      }}
      onClose={() => {
        if (!pending) {
          onCancel();
        }
      }}
      onClick={(event) => {
        // Yalnızca dialog'un kendi (backdrop) alanına tıklamak buraya düşer;
        // içindeki butonlar/metin kendi click event'lerini durdurmaz ama
        // `event.target === dialogRef.current` kontrolü iç tıklamaları eler.
        if (pending) return;
        if (event.target === dialogRef.current) {
          onCancel();
        }
      }}
    >
      <div className="ui-confirm-dialog-body">
        <h2 id={titleId} className="ui-confirm-dialog-title">
          {title}
        </h2>
        <p id={descriptionId} className="ui-confirm-dialog-description">
          {description}
        </p>

        {error && (
          <p className="ui-confirm-dialog-error" role="alert">
            {error}
          </p>
        )}

        <div className="ui-confirm-dialog-actions">
          <button
            type="button"
            className="ui-confirm-dialog-cancel"
            autoFocus
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="ui-confirm-dialog-confirm"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? 'Siliniyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
