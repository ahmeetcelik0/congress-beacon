'use client';

import * as React from 'react';
import { useActionState } from 'react';
import type { Hall, ProgramImportSession } from '@/lib/api';
import {
  formatIstanbulDateTime as formatDateTime,
  isoToDatetimeLocal as toDateTimeLocal,
} from '@/lib/congress-time';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleManager } from './role-manager';
import { PresentationsPanel } from './presentations-panel';
import { updateProgramImportSessionAction, type FormState } from './actions';
import { ROW_STATUS_LABELS, ROW_STATUS_TONES } from '../status-labels';
import type { DeleteTarget } from './delete-target';

const initialState: FormState = { error: null, saved: false };

/**
 * Tek bir staging oturum kartı. Üç görsel durum kasıtlı olarak ayrışır (bkz.
 * görev tanımı): `status === 'INVALID'` kırmızı kenarlık + `message`,
 * `status === 'EXCLUDED'` soluk/salt-okunur görünüm + sabit not, `warning`
 * dolu (status NEW iken de) sarı not satırı. İkisi de yoksa nötr.
 * `EXCLUDED` bir satırın rolleri/sunumları da salt-okunur hale getirilir
 * (tekrar dahil etme uç noktası yok, düzenlemenin bir anlamı kalmıyor).
 */
export function SessionRow({
  importId,
  session,
  halls,
  editable,
  onRequestDelete,
}: {
  importId: string;
  session: ProgramImportSession;
  halls: Hall[];
  editable: boolean;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(
    () => updateProgramImportSessionAction.bind(null, importId, session.id),
    [importId, session.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);
  const panelId = `import-session-panel-${session.id}`;

  React.useEffect(() => {
    if (!state.saved) return;
    const timer = setTimeout(() => setEditing(false), 0);
    return () => clearTimeout(timer);
  }, [state]);

  const isExcluded = session.status === 'EXCLUDED';
  const isInvalid = session.status === 'INVALID';
  const rowEditable = editable && !isExcluded;

  const tone = isInvalid ? 'critical' : isExcluded ? 'excluded' : session.warning ? 'warning' : 'clean';
  const hallName = halls.find((h) => h.id === session.hallId)?.name ?? session.rawHallName ?? '—';
  const moderatorNames = session.roles.filter((r) => r.type === 'MODERATOR').map((r) => r.rawName);

  return (
    <li className="import-session-card" data-tone={tone}>
      <div className="import-session-header">
        <button
          type="button"
          className="sessions-card-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sessions-card-summary">
            <span className="import-session-title-row">
              <span className="sessions-card-title">{session.title ?? '(başlıksız oturum)'}</span>
              <StatusBadge tone={ROW_STATUS_TONES[session.status]}>
                {ROW_STATUS_LABELS[session.status]}
              </StatusBadge>
            </span>
            <span className="sessions-card-meta">
              <span>
                {formatDateTime(session.startTime)} – {formatDateTime(session.endTime)}
              </span>
              <span>{hallName}</span>
              {session.sessionType && <span>{session.sessionType}</span>}
              {session.dayLabel && <span>{session.dayLabel}</span>}
            </span>
            {moderatorNames.length > 0 && (
              <span className="sessions-card-moderators">Moderatör: {moderatorNames.join(', ')}</span>
            )}
          </span>
          <span className="sessions-card-chevron" data-open={open} aria-hidden="true" />
        </button>

        {rowEditable && (
          <div className="import-row-actions">
            <button type="button" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Vazgeç' : 'Düzenle'}
            </button>
            <button
              type="button"
              className="sessions-inline-delete"
              onClick={() =>
                onRequestDelete({
                  kind: 'session',
                  id: session.id,
                  label: session.title ?? '(başlıksız oturum)',
                })
              }
            >
              Çıkar
            </button>
          </div>
        )}
      </div>

      {isInvalid && session.message && (
        <p className="import-message-text import-message-critical">{session.message}</p>
      )}
      {isExcluded && (
        <p className="import-message-text import-message-neutral">
          Bu oturum panelden çıkarıldı — yalnızca görüntülenebilir.
        </p>
      )}
      {!isExcluded && session.warning && (
        <p className="import-warning-text">
          {session.warning.split('; ').map((part) => (
            <span key={part} className="import-warning-item">
              {part}
            </span>
          ))}
        </p>
      )}

      {editing && rowEditable && (
        <form action={formAction} className="import-edit-form import-session-edit-form">
          <label className="sessions-form-span-full">
            Başlık
            <input type="text" name="title" defaultValue={session.title ?? ''} required minLength={1} autoFocus />
          </label>
          <label>
            Salon
            <Select name="hallId" defaultValue={session.hallId ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Salon seçin" />
              </SelectTrigger>
              <SelectContent>
                {halls.map((hall) => (
                  <SelectItem key={hall.id} value={hall.id}>
                    {hall.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Gün etiketi <span className="content-form-optional">(opsiyonel)</span>
            <input type="text" name="dayLabel" defaultValue={session.dayLabel ?? ''} />
          </label>
          <label>
            Oturum türü <span className="content-form-optional">(opsiyonel)</span>
            <input type="text" name="sessionType" defaultValue={session.sessionType ?? ''} />
          </label>
          <label>
            Başlangıç
            <input type="datetime-local" name="startTime" defaultValue={toDateTimeLocal(session.startTime)} />
          </label>
          <label>
            Bitiş
            <input type="datetime-local" name="endTime" defaultValue={toDateTimeLocal(session.endTime)} />
          </label>
          <label className="sessions-form-span-full">
            Anahtar kelimeler <span className="content-form-optional">(opsiyonel)</span>
            <input type="text" name="keywords" defaultValue={session.keywords ?? ''} />
          </label>
          <div className="sessions-form-span-full import-edit-form-actions">
            <button type="submit" disabled={pending}>
              {pending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
          {state.error && (
            <p className="panel-error sessions-form-span-full" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}

      <CollapsibleRegion id={panelId} open={open} innerClassName="sessions-card-body">
        <section aria-labelledby={`${panelId}-roles-heading`} className="sessions-card-section">
          <h4 id={`${panelId}-roles-heading`} className="sessions-subheading">
            Moderatör / Tartışmacı
          </h4>
          <RoleManager
            importId={importId}
            roles={session.roles}
            parent={{ importSessionId: session.id }}
            typeOptions={['MODERATOR', 'DISCUSSANT']}
            emptyLabel="Bu oturuma henüz moderatör/tartışmacı eklenmedi."
            editable={rowEditable}
            onRequestDelete={onRequestDelete}
          />
        </section>

        <section className="sessions-card-section" aria-label="Sunumlar">
          <PresentationsPanel
            importId={importId}
            importSessionId={session.id}
            presentations={session.presentations}
            editable={rowEditable}
            onRequestDelete={onRequestDelete}
          />
        </section>
      </CollapsibleRegion>
    </li>
  );
}
