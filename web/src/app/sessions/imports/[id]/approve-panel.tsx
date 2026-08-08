'use client';

import * as React from 'react';
import { useTransition } from 'react';
import Link from 'next/link';
import type { ProgramImportApproveSummary, ProgramImportStatus } from '@/lib/api';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { approveProgramImportAction, cancelProgramImportAction } from './actions';

const STATUS_MESSAGES: Partial<Record<ProgramImportStatus, string>> = {
  APPROVED: 'Bu yükleme onaylanmış ve bilimsel programa işlenmiştir. Satırlar artık düzenlenemez.',
  CANCELLED: 'Bu yükleme iptal edilmiştir. Hiçbir oturum programa işlenmedi.',
};

/**
 * Onaylama/iptal etme paneli — Faz 2'nin `ImportApprovePanel`ıyla AYNI desen
 * (ikisi de pratikte geri alınamaz toplu işlemler, `ConfirmDeleteDialog`
 * yeniden kullanılır). Fark: onay diyaloğu ayrıca bu kongrede HALİHAZIRDA
 * kaç canlı oturum olduğunu gösterir ("üzerine yazmaz, yanına ekler" netliği
 * için, bkz. görev tanımı).
 */
export function ApprovePanel({
  importId,
  congressId,
  status,
  toProcess,
  toSkip,
  existingSessionsCount,
}: {
  importId: string;
  congressId: string;
  status: ProgramImportStatus;
  toProcess: number;
  toSkip: number;
  existingSessionsCount: number;
}) {
  const [confirmAction, setConfirmAction] = React.useState<'approve' | 'cancel' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [approveResult, setApproveResult] = React.useState<ProgramImportApproveSummary | null>(null);

  function handleConfirm() {
    if (!confirmAction) return;
    setError(null);
    startTransition(async () => {
      if (confirmAction === 'approve') {
        const outcome = await approveProgramImportAction(importId);
        if (outcome.error) {
          setError(outcome.error);
          return;
        }
        setApproveResult(outcome.result);
      } else {
        const outcome = await cancelProgramImportAction(importId);
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
      <section className="import-approve-panel" aria-labelledby="import-approve-heading">
        <h2 id="import-approve-heading">Onaylama</h2>
        <p className="import-approve-summary">{STATUS_MESSAGES[status]}</p>
        {approveResult && (
          <div className="import-approve-result" role="status">
            <strong>Onaylandı:</strong>
            <ul>
              <li>{approveResult.createdSessions} oturum oluşturuldu</li>
              <li>{approveResult.createdPresentations} sunum oluşturuldu</li>
              <li>{approveResult.createdRoles} rol oluşturuldu</li>
              <li>{approveResult.skippedPresentations} sunum atlandı (başlıksız)</li>
            </ul>
          </div>
        )}
        {status === 'APPROVED' && (
          <Link href={`/sessions?congressId=${congressId}`}>Bilimsel Program sayfasına dön →</Link>
        )}
      </section>
    );
  }

  return (
    <section className="reg-approve-panel" aria-labelledby="import-approve-heading">
      <h2 id="import-approve-heading">Onaylama</h2>
      <p className="import-approve-summary">
        <strong>{toProcess}</strong> oturum bilimsel programa işlenecek (Yeni) ·{' '}
        <strong>{toSkip}</strong> oturum atlanacak (Geçersiz + Çıkarıldı)
      </p>
      <div className="import-approve-actions">
        <button
          type="button"
          className="import-approve-confirm"
          disabled={toProcess === 0}
          onClick={() => {
            setError(null);
            setConfirmAction('approve');
          }}
        >
          Onayla ve Programa İşle
        </button>
        <button
          type="button"
          className="import-approve-cancel"
          onClick={() => {
            setError(null);
            setConfirmAction('cancel');
          }}
        >
          Yüklemeyi İptal Et
        </button>
      </div>

      <ConfirmDeleteDialog
        open={confirmAction !== null}
        title={confirmAction === 'approve' ? 'Yüklemeyi onayla' : 'Yüklemeyi iptal et'}
        description={
          confirmAction === 'approve' ? (
            <>
              Bu kongrede halihazırda <strong>{existingSessionsCount}</strong> oturum var, bu işlem{' '}
              <strong>{toProcess}</strong> oturum daha ekleyecek (üzerine yazmaz, yanına ekler). Bu
              işlem geri alınamaz.
            </>
          ) : (
            <>
              Bu yükleme taslağı iptal edilecek, hiçbir oturum programa işlenmeyecek. Bu işlem geri
              alınamaz.
            </>
          )
        }
        confirmLabel={confirmAction === 'approve' ? 'Onayla ve işle' : 'Yüklemeyi iptal et'}
        cancelLabel="Vazgeç"
        pending={pending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={handleCancelDialog}
      />
    </section>
  );
}
