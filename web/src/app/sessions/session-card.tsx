'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { Session } from '@/lib/api';
import { formatIstanbulDateTime as formatDateTime } from '@/lib/congress-time';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { RoleManager } from './role-manager';
import { PresentationsPanel } from './presentations-panel';
import { ReorderButtons } from './reorder-buttons';
import { computeReorderedIds } from './reorder';
import { reorderSessionsAction } from './session-actions';
import type { DeleteTarget } from './delete-target';

/**
 * Tek bir oturumun genisleyebilir karti. `items`/`index`, GORUNEN
 * (gun/salon filtresinden gecmis) listeye gore hesaplanir - yukari/asagi
 * butonlari yalnizca bu filtrelenmis alt kumeyi yeniden siralar, filtre
 * disindaki oturumlara dokunmaz (bkz. `SessionsBoard`, gorev tanimi).
 */
export function SessionCard({
  session,
  items,
  index,
  hallName,
  onRequestDelete,
}: {
  session: Session;
  items: Session[];
  index: number;
  hallName: string;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [reorderPending, startReorderTransition] = useTransition();
  const [reorderError, setReorderError] = React.useState<string | null>(null);
  const panelId = `session-panel-${session.id}`;

  const moderatorNames = session.roles
    .filter((role) => role.type === 'MODERATOR')
    .map((role) => role.rawName);

  function handleMove(direction: 'up' | 'down') {
    setReorderError(null);
    const ids = computeReorderedIds(items, index, direction);
    startReorderTransition(async () => {
      const result = await reorderSessionsAction(ids);
      if (result.error) setReorderError(result.error);
    });
  }

  return (
    <li className="sessions-card">
      <div className="sessions-card-header">
        <ReorderButtons
          itemLabel={session.title}
          onMoveUp={() => handleMove('up')}
          onMoveDown={() => handleMove('down')}
          disabledUp={index === 0}
          disabledDown={index === items.length - 1}
          pending={reorderPending}
        />

        <button
          type="button"
          className="sessions-card-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sessions-card-summary">
            <span className="sessions-card-title">{session.title}</span>
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

        <button
          type="button"
          className="sessions-inline-delete"
          onClick={() => onRequestDelete({ kind: 'session', id: session.id, label: session.title })}
        >
          Sil
        </button>
      </div>

      {reorderError && (
        <p className="panel-error sessions-row-error" role="alert">
          {reorderError}
        </p>
      )}

      <CollapsibleRegion id={panelId} open={open} innerClassName="sessions-card-body">
        <section aria-labelledby={`${panelId}-roles-heading`} className="sessions-card-section">
          <h4 id={`${panelId}-roles-heading`} className="sessions-subheading">
            Moderatör / Tartışmacı
          </h4>
          <RoleManager
            roles={session.roles}
            parent={{ sessionId: session.id }}
            typeOptions={['MODERATOR', 'DISCUSSANT']}
            emptyLabel="Bu oturuma henüz moderatör/tartışmacı eklenmedi."
            onRequestDelete={onRequestDelete}
          />
        </section>

        <section className="sessions-card-section" aria-label="Sunumlar">
          <PresentationsPanel
            sessionId={session.id}
            presentations={session.presentations}
            onRequestDelete={onRequestDelete}
          />
        </section>
      </CollapsibleRegion>
    </li>
  );
}
