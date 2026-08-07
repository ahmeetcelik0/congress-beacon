'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';
import type { KeynoteSpeaker } from '@/lib/api';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { ReorderButtons } from '../components/reorder-buttons';
import { computeReorderedIds } from '../reorder';
import { updateKeynoteSpeakerAction, reorderKeynoteSpeakersAction, type FormState } from './actions';

const emptyState: FormState = { error: null };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function SpeakerRow({
  item,
  items,
  index,
  congressId,
  onRequestDelete,
}: {
  item: KeynoteSpeaker;
  items: KeynoteSpeaker[];
  index: number;
  congressId: string;
  onRequestDelete: (item: KeynoteSpeaker) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(() => updateKeynoteSpeakerAction.bind(null, item.id), [item.id]);
  const [state, formAction, pending] = useActionState(boundUpdate, emptyState);

  const [reorderPending, startReorderTransition] = useTransition();
  const [reorderError, setReorderError] = React.useState<string | null>(null);

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
      const result = await reorderKeynoteSpeakersAction(ids);
      if (result.error) setReorderError(result.error);
    });
  }

  if (editing) {
    return (
      <tr className="content-row-editing">
        <td colSpan={4} className="content-edit-cell">
          <form action={formAction} className="content-edit-form content-form-grid">
            <label>
              Ad soyad
              <input
                ref={firstFieldRef}
                name="fullName"
                defaultValue={item.fullName}
                required
                minLength={1}
              />
            </label>
            <label>
              Unvan
              <input type="text" name="title" defaultValue={item.title ?? ''} />
            </label>
            <label>
              Kurum
              <input type="text" name="institution" defaultValue={item.institution ?? ''} />
            </label>
            <label>
              Ülke
              <input type="text" name="country" defaultValue={item.country ?? ''} />
            </label>
            <label className="content-form-span-2">
              Biyografi
              <textarea name="bio" rows={3} defaultValue={item.bio ?? ''} />
            </label>
            <div className="content-form-span-2">
              <ImageUploadField
                label="Fotoğraf"
                name="photoUrl"
                congressId={congressId}
                purpose="speaker"
                defaultValue={item.photoUrl}
                hint="JPEG, PNG veya WEBP — en fazla 2 MB."
              />
            </div>
            <div className="content-edit-form-actions content-form-span-2">
              <button type="submit" disabled={pending}>
                {pending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={pending}>
                İptal
              </button>
            </div>
            {state.error && (
              <p className="panel-error content-form-span-2" role="alert">
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
          itemLabel={item.fullName}
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
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_URL}${item.photoUrl}`} alt="" className="content-thumbnail content-thumbnail-round" />
        ) : (
          <div className="content-thumbnail-placeholder content-thumbnail-round" aria-hidden="true" />
        )}
      </td>
      <td>
        <p className="content-cell-title">{item.fullName}</p>
        <p className="content-cell-subtitle">
          {[item.title, item.institution, item.country].filter(Boolean).join(' · ') || '—'}
        </p>
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
