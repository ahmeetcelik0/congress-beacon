'use client';

import * as React from 'react';
import { useActionState } from 'react';
import type { ProgramImportPresentation } from '@/lib/api';
import {
  formatIstanbulDateTime as formatTime,
  isoToDatetimeLocal as toDateTimeLocal,
} from '@/lib/congress-time';
import { RoleManager } from './role-manager';
import {
  createProgramImportPresentationAction,
  updateProgramImportPresentationAction,
  type FormState,
} from './actions';
import type { DeleteTarget } from './delete-target';

const initialState: FormState = { error: null, saved: false };

function PresentationRow({
  importId,
  presentation,
  editable,
  onRequestDelete,
}: {
  importId: string;
  presentation: ProgramImportPresentation;
  editable: boolean;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(
    () => updateProgramImportPresentationAction.bind(null, importId, presentation.id),
    [importId, presentation.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);

  React.useEffect(() => {
    if (!state.saved) return;
    const timer = setTimeout(() => setEditing(false), 0);
    return () => clearTimeout(timer);
  }, [state]);

  const toneClass = presentation.warning ? 'import-tone-warning' : undefined;

  return (
    <li className={`sessions-presentation-item ${toneClass ?? ''}`}>
      {editing ? (
        <form action={formAction} className="import-edit-form">
          <label className="sessions-form-span-full">
            Sunum başlığı
            <input type="text" name="title" defaultValue={presentation.title ?? ''} required minLength={1} autoFocus />
          </label>
          <label>
            Başlangıç <span className="content-form-optional">(opsiyonel)</span>
            <input type="datetime-local" name="startTime" defaultValue={toDateTimeLocal(presentation.startTime)} />
          </label>
          <label>
            Bitiş <span className="content-form-optional">(opsiyonel)</span>
            <input type="datetime-local" name="endTime" defaultValue={toDateTimeLocal(presentation.endTime)} />
          </label>
          <div className="sessions-form-span-full import-edit-form-actions">
            <button type="submit" disabled={pending}>
              {pending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={pending}>
              İptal
            </button>
          </div>
          {state.error && (
            <p className="panel-error sessions-form-span-full" role="alert">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <div className="sessions-presentation-header">
          <div className="sessions-presentation-header-text">
            <p className="sessions-presentation-title">{presentation.title ?? '(başlıksız)'}</p>
            <p className="sessions-presentation-time">
              {formatTime(presentation.startTime)} – {formatTime(presentation.endTime)}
            </p>
            {presentation.abstract && (
              <p className="sessions-presentation-abstract">{presentation.abstract}</p>
            )}
            {presentation.warning && (
              <p className="import-warning-text">
                {presentation.warning.split('; ').map((part) => (
                  <span key={part} className="import-warning-item">
                    {part}
                  </span>
                ))}
              </p>
            )}
          </div>
          {editable && (
            <div className="import-row-actions">
              <button type="button" onClick={() => setEditing(true)}>
                Düzenle
              </button>
              <button
                type="button"
                className="sessions-inline-delete"
                onClick={() =>
                  onRequestDelete({
                    kind: 'presentation',
                    id: presentation.id,
                    label: presentation.title ?? '(başlıksız sunum)',
                  })
                }
              >
                Sil
              </button>
            </div>
          )}
        </div>
      )}

      <RoleManager
        importId={importId}
        roles={presentation.roles}
        parent={{ importPresentationId: presentation.id }}
        typeOptions={['SPEAKER', 'DISCUSSANT']}
        emptyLabel="Bu sunum için henüz konuşmacı eklenmedi."
        editable={editable}
        onRequestDelete={onRequestDelete}
      />
    </li>
  );
}

/**
 * Bir staging oturumunun iç içe sunum listesi + ekleme formu (Faz 4a'nın
 * `presentations-panel.tsx`'iyle AYNI yapı) — buradaki fark, her satırın
 * kendi düzenleme moduna (Faz 2 `ImportRow`'daki gibi) geçebilmesi ve
 * sıralama/`reorder` bulunmamasıdır (staging satırları için böyle bir uç
 * nokta yok).
 */
export function PresentationsPanel({
  importId,
  importSessionId,
  presentations,
  editable,
  onRequestDelete,
}: {
  importId: string;
  importSessionId: string;
  presentations: ProgramImportPresentation[];
  editable: boolean;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const boundCreate = React.useMemo(
    () => createProgramImportPresentationAction.bind(null, importId, importSessionId),
    [importId, importSessionId],
  );
  const [state, formAction, pending] = useActionState(boundCreate, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.error) return;
    const timer = setTimeout(() => formRef.current?.reset(), 0);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="sessions-presentations-panel">
      <h4 className="sessions-subheading">Sunumlar</h4>
      {presentations.length === 0 ? (
        <p className="sessions-role-empty">Bu oturuma henüz sunum eklenmedi.</p>
      ) : (
        <ul className="sessions-presentation-list">
          {presentations.map((presentation) => (
            <PresentationRow
              key={presentation.id}
              importId={importId}
              presentation={presentation}
              editable={editable}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      )}

      {editable && (
        <form ref={formRef} action={formAction} className="sessions-presentation-form">
          <label>
            Sunum başlığı
            <input type="text" name="title" required minLength={1} />
          </label>
          <label>
            Başlangıç <span className="content-form-optional">(opsiyonel)</span>
            <input type="datetime-local" name="startTime" />
          </label>
          <label>
            Bitiş <span className="content-form-optional">(opsiyonel)</span>
            <input type="datetime-local" name="endTime" />
          </label>
          <div className="sessions-form-span-full sessions-presentation-form-footer">
            <button type="submit" disabled={pending}>
              {pending ? 'Ekleniyor…' : 'Sunum ekle'}
            </button>
          </div>
          {state.error && (
            <p className="panel-error sessions-form-span-full" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
