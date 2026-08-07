'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';
import type { Announcement } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { ReorderButtons } from '../components/reorder-buttons';
import { computeReorderedIds } from '../reorder';
import {
  updateAnnouncementAction,
  reorderAnnouncementsAction,
  publishAnnouncementAction,
  unpublishAnnouncementAction,
  type FormState,
} from './actions';

const emptyState: FormState = { error: null };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnnouncementRow({
  item,
  items,
  index,
  onRequestDelete,
}: {
  item: Announcement;
  items: Announcement[];
  index: number;
  onRequestDelete: (item: Announcement) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(() => updateAnnouncementAction.bind(null, item.id), [item.id]);
  const [state, formAction, pending] = useActionState(boundUpdate, emptyState);

  const [reorderPending, startReorderTransition] = useTransition();
  const [reorderError, setReorderError] = React.useState<string | null>(null);

  const [publishPending, startPublishTransition] = useTransition();
  const [publishError, setPublishError] = React.useState<string | null>(null);

  const editTriggerRef = React.useRef<HTMLButtonElement>(null);
  const firstFieldRef = React.useRef<HTMLInputElement>(null);
  const wasEditingRef = React.useRef(false);

  React.useEffect(() => {
    if (!state.error && editing) {
      const timer = setTimeout(() => setEditing(false), 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  React.useEffect(() => {
    if (editing) {
      firstFieldRef.current?.focus();
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      editTriggerRef.current?.focus();
      wasEditingRef.current = false;
    }
  }, [editing]);

  function handleMove(direction: 'up' | 'down') {
    setReorderError(null);
    const ids = computeReorderedIds(items, index, direction);
    startReorderTransition(async () => {
      const result = await reorderAnnouncementsAction(ids);
      if (result.error) setReorderError(result.error);
    });
  }

  function handleTogglePublish() {
    setPublishError(null);
    startPublishTransition(async () => {
      const result = item.publishedAt
        ? await unpublishAnnouncementAction(item.id)
        : await publishAnnouncementAction(item.id);
      if (result.error) setPublishError(result.error);
    });
  }

  if (editing) {
    return (
      <tr className="content-row-editing">
        <td colSpan={5} className="content-edit-cell">
          <form action={formAction} className="content-edit-form">
            <label>
              Başlık
              <input ref={firstFieldRef} name="title" defaultValue={item.title} required minLength={1} />
            </label>
            <label>
              İçerik
              <textarea name="body" required rows={4} defaultValue={item.body} />
            </label>
            <label className="content-checkbox-label">
              <input type="checkbox" name="isPinned" defaultChecked={item.isPinned} />
              Sabitle
            </label>
            <div className="content-edit-form-actions">
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
    <tr>
      <td>
        <ReorderButtons
          itemLabel={item.title}
          onMoveUp={() => handleMove('up')}
          onMoveDown={() => handleMove('down')}
          disabledUp={index === 0}
          disabledDown={index === items.length - 1}
          pending={reorderPending}
        />
        {reorderError && (
          <p className="panel-error content-row-error" role="alert">
            {reorderError}
          </p>
        )}
      </td>
      <td>
        <p className="content-cell-title">
          {item.isPinned && <span title="Sabitlenmiş" aria-label="Sabitlenmiş"> 📌 </span>}
          {item.title}
        </p>
        <p className="content-cell-subtitle">
          {item.body.slice(0, 90)}
          {item.body.length > 90 ? '…' : ''}
        </p>
      </td>
      <td>
        <StatusBadge tone={item.publishedAt ? 'positive' : 'warning'}>
          {item.publishedAt ? 'Yayında' : 'Taslak'}
        </StatusBadge>
        {item.publishedAt && (
          <p className="content-cell-subtitle">{formatDateTime(item.publishedAt)}</p>
        )}
      </td>
      <td className="content-row-actions">
        <button type="button" onClick={handleTogglePublish} disabled={publishPending}>
          {publishPending ? 'İşleniyor…' : item.publishedAt ? 'Taslağa al' : 'Yayınla'}
        </button>
        {publishError && (
          <p className="panel-error content-row-error" role="alert">
            {publishError}
          </p>
        )}
      </td>
      <td className="content-row-actions">
        <button type="button" ref={editTriggerRef} onClick={() => setEditing(true)}>
          Düzenle
        </button>
        <button type="button" onClick={() => onRequestDelete(item)}>
          Sil
        </button>
      </td>
    </tr>
  );
}
