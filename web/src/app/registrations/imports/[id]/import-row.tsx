'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { RegistrationImportRow, RegistrationImportRowStatus } from '@/lib/api';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { excludeImportRowAction, updateImportRowAction, type ImportRowFormState } from './actions';

const STATUS_LABELS: Record<RegistrationImportRowStatus, string> = {
  NEW: 'Yeni',
  MATCHED: 'Eşleşti',
  DUPLICATE: 'Tekrar',
  INVALID: 'Geçersiz',
  EXCLUDED: 'Çıkarıldı',
};

const STATUS_TONES: Record<RegistrationImportRowStatus, StatusTone> = {
  NEW: 'info',
  MATCHED: 'positive',
  DUPLICATE: 'neutral',
  INVALID: 'critical',
  EXCLUDED: 'neutral',
};

const emptyState: ImportRowFormState = { error: null, saved: false };

/**
 * Tek bir içe aktarma satırı. Üç görsel durum kasıtlı olarak birbirinden
 * ayrılır (bkz. proje teslim talimatı): INVALID kırmızı zemin + `message`
 * metni, uyarılı-ama-geçerli satır (status INVALID DEĞİL ama `warning`
 * dolu) sarı zemin + `warning` metni, temiz satır düz zemin.
 */
export function ImportRow({
  row,
  importId,
  editable,
}: {
  row: RegistrationImportRow;
  importId: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = useMemo(
    () => updateImportRowAction.bind(null, importId, row.id),
    [importId, row.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, emptyState);
  const [excludePending, startExcludeTransition] = useTransition();
  const [excludeError, setExcludeError] = useState<string | null>(null);

  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const wasEditingRef = useRef(false);

  useEffect(() => {
    if (!state.saved) return;
    // `revalidatePath` sunucu verisini tazeler ve yeni `row` prop'u gelir;
    // duzenleme modundan cikmayi ayri bir setState olarak tetiklemek
    // (react-hooks/set-state-in-effect) zamanlayici callback'i gerektirir.
    const timer = setTimeout(() => setEditing(false), 0);
    return () => clearTimeout(timer);
  }, [state]);

  // Duzenleme moduna girildiginde satirin JSX'i tamamen degisir ve tiklanan
  // "Duzenle" butonu DOM'dan kalkar - odak tarayici tarafindan body'ye
  // duser. Ilk alana ve (cikista) tetikleyici butona ELLE odaklaniyoruz -
  // ayni desen registrations-table.tsx'teki RegistrationRow'da da var.
  useEffect(() => {
    if (editing) {
      firstFieldRef.current?.focus();
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      editTriggerRef.current?.focus();
      wasEditingRef.current = false;
    }
  }, [editing]);

  function handleExclude() {
    setExcludeError(null);
    startExcludeTransition(async () => {
      const result = await excludeImportRowAction(importId, row.id);
      if (result.error) {
        setExcludeError(result.error);
      }
    });
  }

  const rowClassName =
    row.status === 'INVALID'
      ? 'reg-row-status-critical'
      : row.warning
        ? 'reg-row-status-warning'
        : undefined;

  if (editing) {
    return (
      <tr className={rowClassName}>
        <td colSpan={6} className="reg-edit-cell">
          <form action={formAction} className="reg-edit-form">
            <label>
              Ad
              <input
                ref={firstFieldRef}
                name="firstName"
                defaultValue={row.rawFirstName ?? ''}
              />
            </label>
            <label>
              Soyad
              <input name="lastName" defaultValue={row.rawLastName ?? ''} />
            </label>
            <label>
              E-posta
              <input type="email" name="email" defaultValue={row.rawEmail ?? ''} />
            </label>
            <label>
              Telefon
              <input type="tel" name="phone" defaultValue={row.rawPhone ?? ''} />
            </label>
            <div className="reg-edit-form-actions">
              <button type="submit" disabled={pending}>
                {pending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={pending}>
                İptal
              </button>
            </div>
            {state.error && (
              <p className="panel-error" role="alert">
                {state.error}
              </p>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className={rowClassName}>
      <td>{row.rowNumber}</td>
      <td>
        {(row.rawFirstName ?? '—')} {row.rawLastName ?? ''}
      </td>
      <td>{row.rawEmail ?? '—'}</td>
      <td>{row.rawPhone ?? '—'}</td>
      <td>
        <StatusBadge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</StatusBadge>
        {row.status === 'INVALID' && row.message && (
          <p className="reg-row-message reg-row-message-critical">{row.message}</p>
        )}
        {row.status !== 'INVALID' && row.warning && (
          <p className="reg-row-message reg-row-message-warning">{row.warning}</p>
        )}
      </td>
      <td className="reg-row-actions">
        {editable && (
          <button type="button" ref={editTriggerRef} onClick={() => setEditing(true)}>
            Düzenle
          </button>
        )}
        {editable && row.status !== 'EXCLUDED' && (
          <button type="button" onClick={handleExclude} disabled={excludePending}>
            {excludePending ? 'Çıkarılıyor…' : 'Çıkar'}
          </button>
        )}
        {!editable && <span className="reg-contact-missing">—</span>}
        {excludeError && (
          <p className="panel-error reg-row-error" role="alert">
            {excludeError}
          </p>
        )}
      </td>
    </tr>
  );
}
