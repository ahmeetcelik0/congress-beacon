'use client';

import { useState, useTransition } from 'react';
import type { RegistrationImportApproveResult, RegistrationImportStatus } from '@/lib/api';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { approveImportAction, cancelImportAction } from './actions';

const STATUS_MESSAGES: Record<Exclude<RegistrationImportStatus, 'DRAFT'>, string> = {
  APPROVED: 'Bu içe aktarma onaylanmış ve kayıtlara işlenmiştir. Satırlar artık düzenlenemez.',
  CANCELLED: 'Bu içe aktarma iptal edilmiştir. Hiçbir satır kayıtlara işlenmedi.',
};

/**
 * Onaylama/iptal etme paneli - ikisi de toplu ve (API sözleşmesinde geri
 * alma uç noktası olmadığı için) pratikte GERİ ALINAMAZ işlemler oldukları
 * için `ConfirmDeleteDialog` deseni her ikisi için de kullanılır
 * (bkz. proje teslim talimatı: "geri dönüşü olmayan toplu bir işlem").
 */
export function ImportApprovePanel({
  importId,
  status,
  toProcess,
  toSkip,
}: {
  importId: string;
  status: RegistrationImportStatus;
  toProcess: number;
  toSkip: number;
}) {
  const [confirmAction, setConfirmAction] = useState<'approve' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [approveResult, setApproveResult] = useState<RegistrationImportApproveResult | null>(null);

  function handleConfirm() {
    if (!confirmAction) return;
    setError(null);
    startTransition(async () => {
      if (confirmAction === 'approve') {
        const outcome = await approveImportAction(importId);
        if (outcome.error) {
          setError(outcome.error);
          return;
        }
        setApproveResult(outcome.result);
      } else {
        const outcome = await cancelImportAction(importId);
        if (outcome.error) {
          setError(outcome.error);
          return;
        }
      }
      setConfirmAction(null);
    });
  }

  function handleCancelDialog() {
    if (pending) return;
    setConfirmAction(null);
    setError(null);
  }

  if (status !== 'DRAFT') {
    return (
      <section className="reg-approve-panel" aria-labelledby="reg-approve-heading">
        <h2 id="reg-approve-heading">Onaylama</h2>
        <p className="reg-approve-summary">{STATUS_MESSAGES[status]}</p>
        {approveResult && (
          <div className="reg-approve-result" role="status">
            <strong>Onaylandı:</strong>
            <ul>
              <li>{approveResult.createdUsers} yeni kullanıcı oluşturuldu</li>
              <li>{approveResult.updatedUsers} mevcut kullanıcı güncellendi</li>
              <li>{approveResult.createdRegistrations} kongre kaydı oluşturuldu</li>
              <li>{approveResult.skipped} satır atlandı</li>
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="reg-approve-panel" aria-labelledby="reg-approve-heading">
      <h2 id="reg-approve-heading">Onaylama</h2>
      <p className="reg-approve-summary">
        <strong>{toProcess}</strong> satır kayıtlara işlenecek (Yeni + Eşleşti) ·{' '}
        <strong>{toSkip}</strong> satır atlanacak (Tekrar + Geçersiz + Çıkarıldı)
      </p>
      <div className="reg-approve-actions">
        <button
          type="button"
          className="reg-approve-confirm"
          disabled={toProcess === 0}
          onClick={() => {
            setError(null);
            setConfirmAction('approve');
          }}
        >
          Onayla ve Kayıtlara İşle
        </button>
        <button
          type="button"
          className="reg-approve-cancel"
          onClick={() => {
            setError(null);
            setConfirmAction('cancel');
          }}
        >
          İçe Aktarmayı İptal Et
        </button>
      </div>

      <ConfirmDeleteDialog
        open={confirmAction !== null}
        title={confirmAction === 'approve' ? 'İçe aktarmayı onayla' : 'İçe aktarmayı iptal et'}
        description={
          confirmAction === 'approve' ? (
            <>
              <strong>{toProcess}</strong> satır kalıcı olarak kayıtlara işlenecek. Bu işlem geri
              alınamaz.
            </>
          ) : (
            <>
              Bu içe aktarma taslağı iptal edilecek, hiçbir satır kayıtlara işlenmeyecek. Bu işlem
              geri alınamaz.
            </>
          )
        }
        confirmLabel={confirmAction === 'approve' ? 'Onayla ve işle' : 'İçe aktarmayı iptal et'}
        cancelLabel="Vazgeç"
        pending={pending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={handleCancelDialog}
      />
    </section>
  );
}
