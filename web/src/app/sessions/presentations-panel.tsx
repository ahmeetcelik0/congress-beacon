'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';
import type { Presentation } from '@/lib/api';
import { RoleManager } from './role-manager';
import { ReorderButtons } from './reorder-buttons';
import { computeReorderedIds } from './reorder';
import {
  createPresentationAction,
  reorderPresentationsAction,
  type FormState,
} from './presentation-actions';
import type { DeleteTarget } from './delete-target';

const initialState: FormState = { error: null };

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PresentationItem({
  presentation,
  items,
  index,
  onRequestDelete,
}: {
  presentation: Presentation;
  items: Presentation[];
  index: number;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const [reorderPending, startReorderTransition] = useTransition();
  const [reorderError, setReorderError] = React.useState<string | null>(null);

  function handleMove(direction: 'up' | 'down') {
    setReorderError(null);
    const ids = computeReorderedIds(items, index, direction);
    startReorderTransition(async () => {
      const result = await reorderPresentationsAction(ids);
      if (result.error) setReorderError(result.error);
    });
  }

  return (
    <li className="sessions-presentation-item">
      <div className="sessions-presentation-header">
        <ReorderButtons
          itemLabel={presentation.title}
          onMoveUp={() => handleMove('up')}
          onMoveDown={() => handleMove('down')}
          disabledUp={index === 0}
          disabledDown={index === items.length - 1}
          pending={reorderPending}
        />
        <div className="sessions-presentation-header-text">
          <p className="sessions-presentation-title">{presentation.title}</p>
          <p className="sessions-presentation-time">
            {formatTime(presentation.startTime)} – {formatTime(presentation.endTime)}
          </p>
          {presentation.abstract && (
            <p className="sessions-presentation-abstract">{presentation.abstract}</p>
          )}
        </div>
        <button
          type="button"
          className="sessions-inline-delete"
          onClick={() =>
            onRequestDelete({ kind: 'presentation', id: presentation.id, label: presentation.title })
          }
        >
          Sil
        </button>
      </div>
      {reorderError && (
        <p className="panel-error sessions-row-error" role="alert">
          {reorderError}
        </p>
      )}
      <RoleManager
        roles={presentation.roles}
        parent={{ presentationId: presentation.id }}
        typeOptions={['SPEAKER', 'DISCUSSANT']}
        emptyLabel="Bu sunum için henüz konuşmacı eklenmedi."
        onRequestDelete={onRequestDelete}
      />
    </li>
  );
}

/**
 * Bir oturumun ic ice sunum listesi + ekleme formu + sunum basina konusmaci
 * rolleri (`RoleManager`, tur SPEAKER/DISCUSSANT). Sunumlar zaten
 * `GET /sessions` yanitinda `displayOrder`'a gore sirali gelir - burada
 * EKSTRA siralama yapilmaz, yalnizca yukari/asagi butonlari TAM listeyi
 * (bir oturumun TUM sunumlari, filtre kavrami yok) yeniden gonderir.
 */
export function PresentationsPanel({
  sessionId,
  presentations,
  onRequestDelete,
}: {
  sessionId: string;
  presentations: Presentation[];
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const boundCreate = React.useMemo(
    () => createPresentationAction.bind(null, sessionId),
    [sessionId],
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
          {presentations.map((presentation, index) => (
            <PresentationItem
              key={presentation.id}
              presentation={presentation}
              items={presentations}
              index={index}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      )}

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
        <label className="sessions-form-span-full">
          Özet <span className="content-form-optional">(opsiyonel)</span>
          <textarea name="abstract" rows={2} />
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
    </div>
  );
}
