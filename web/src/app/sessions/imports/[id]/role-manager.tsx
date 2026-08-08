'use client';

import * as React from 'react';
import { useActionState } from 'react';
import type { ProgramImportRole, ProgramRoleType } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { MATCH_STATUS_LABELS, MATCH_STATUS_TONES, ROLE_TYPE_LABELS } from '../../role-status';
import {
  createProgramImportRoleAction,
  updateProgramImportRoleAction,
  type FormState,
} from './actions';
import type { DeleteTarget } from './delete-target';

const initialState: FormState = { error: null, saved: false };

function RoleRow({
  importId,
  role,
  editable,
  onRequestDelete,
}: {
  importId: string;
  role: ProgramImportRole;
  editable: boolean;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(
    () => updateProgramImportRoleAction.bind(null, importId, role.id),
    [importId, role.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);

  React.useEffect(() => {
    if (!state.saved) return;
    const timer = setTimeout(() => setEditing(false), 0);
    return () => clearTimeout(timer);
  }, [state]);

  if (editing) {
    return (
      <li className="import-role-item">
        <form action={formAction} className="import-role-edit-form">
          <input type="text" name="rawName" defaultValue={role.rawName} minLength={2} required autoFocus />
          <button type="submit" disabled={pending}>
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={pending}>
            İptal
          </button>
          {state.error && (
            <p className="panel-error import-role-form-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="import-role-item">
      <div className="import-role-item-text">
        <span className="import-role-type">{ROLE_TYPE_LABELS[role.type]}</span>
        <span className="import-role-name">{role.rawName}</span>
        <StatusBadge tone={MATCH_STATUS_TONES[role.previewMatchStatus]}>
          {MATCH_STATUS_LABELS[role.previewMatchStatus]}
        </StatusBadge>
      </div>
      {editable && (
        <div className="import-role-item-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Düzenle
          </button>
          <button
            type="button"
            className="sessions-inline-delete"
            onClick={() =>
              onRequestDelete({
                kind: 'role',
                id: role.id,
                label: `${ROLE_TYPE_LABELS[role.type]}: ${role.rawName}`,
              })
            }
          >
            Sil
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Staging rol listesi + ekleme formu. Faz 4a'nın `RoleManager`ından iki
 * farkı var: (1) `rawName` burada DÜZENLENEBİLİR (kaydedince backend
 * `previewMatchStatus`/`previewUserId`'yi otomatik yeniden hesaplar), (2)
 * rozet `matchStatus` değil `previewMatchStatus`'tur — ikisi de aynı
 * `RoleMatchStatus` enum'unu kullandığı için `role-status.ts` haritaları
 * AYNEN yeniden kullanılabilir.
 */
export function RoleManager({
  importId,
  roles,
  parent,
  typeOptions,
  emptyLabel,
  editable,
  onRequestDelete,
}: {
  importId: string;
  roles: ProgramImportRole[];
  parent: { importSessionId: string } | { importPresentationId: string };
  typeOptions: ProgramRoleType[];
  emptyLabel: string;
  editable: boolean;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const boundCreate = React.useMemo(
    () => createProgramImportRoleAction.bind(null, importId, parent),
    [importId, parent],
  );
  const [state, formAction, pending] = useActionState(boundCreate, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.error) return;
    const timer = setTimeout(() => formRef.current?.reset(), 0);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="import-role-manager">
      {roles.length === 0 ? (
        <p className="sessions-role-empty">{emptyLabel}</p>
      ) : (
        <ul className="import-role-list">
          {roles.map((role) => (
            <RoleRow
              key={role.id}
              importId={importId}
              role={role}
              editable={editable}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      )}

      {editable && (
        <form ref={formRef} action={formAction} className="sessions-role-form">
          <Select name="type" defaultValue={typeOptions[0]} required>
            <SelectTrigger className="sessions-role-type-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((type) => (
                <SelectItem key={type} value={type}>
                  {ROLE_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="text" name="rawName" placeholder="Ad Soyad" required minLength={2} />
          <button type="submit" disabled={pending}>
            {pending ? 'Ekleniyor…' : 'Ekle'}
          </button>
          {state.error && (
            <p className="panel-error sessions-role-form-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
