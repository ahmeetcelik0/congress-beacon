'use client';

import * as React from 'react';
import { useActionState } from 'react';
import type { ProgramRole, ProgramRoleType } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { createRoleAction, type FormState } from './role-actions';
import { MATCH_STATUS_LABELS, MATCH_STATUS_TONES, ROLE_TYPE_LABELS } from './role-status';
import type { DeleteTarget } from './delete-target';

const initialState: FormState = { error: null };

/**
 * Oturum-rolu (moderator/tartismaci) VE sunum-rolu (konusmaci/tartismaci)
 * ekleme/gorutuleme/silme AYNI kalibi kullandigi icin ortak alt bilesen
 * (bkz. gorev tanimi - iki gercek kullanim yeri var: `SessionCard` ve
 * `PresentationItem`). Silme TEK bir sayfa-duzeyi onay dialog'una
 * yonlendirilir (`onRequestDelete`), bu bilesen kendi dialog'unu ACMAZ.
 */
export function RoleManager({
  roles,
  parent,
  typeOptions,
  emptyLabel,
  onRequestDelete,
}: {
  roles: ProgramRole[];
  parent: { sessionId: string } | { presentationId: string };
  typeOptions: ProgramRoleType[];
  emptyLabel: string;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const boundCreate = React.useMemo(() => createRoleAction.bind(null, parent), [parent]);
  const [state, formAction, pending] = useActionState(boundCreate, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.error) return;
    const timer = setTimeout(() => formRef.current?.reset(), 0);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="sessions-role-manager">
      {roles.length === 0 ? (
        <p className="sessions-role-empty">{emptyLabel}</p>
      ) : (
        <ul className="sessions-role-list">
          {roles.map((role) => (
            <li key={role.id} className="sessions-role-item">
              <div className="sessions-role-item-text">
                <span className="sessions-role-type">{ROLE_TYPE_LABELS[role.type]}</span>
                {/* Ham isim HER ZAMAN gosterilir - unvani temizlenmis
                    searchName degil (bkz. gorev tanimi). */}
                <span className="sessions-role-name">{role.rawName}</span>
                <StatusBadge tone={MATCH_STATUS_TONES[role.matchStatus]}>
                  {MATCH_STATUS_LABELS[role.matchStatus]}
                </StatusBadge>
                {role.user && (
                  <span className="sessions-role-user">
                    → {role.user.firstName} {role.user.lastName}
                  </span>
                )}
              </div>
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
            </li>
          ))}
        </ul>
      )}

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
        <input type="text" name="rawName" placeholder="Ad Soyad" required minLength={1} />
        <button type="submit" disabled={pending}>
          {pending ? 'Ekleniyor…' : 'Ekle'}
        </button>
        {state.error && (
          <p className="panel-error sessions-role-form-error" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
