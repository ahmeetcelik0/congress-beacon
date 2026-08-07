'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';
import type { Venue } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { ReorderButtons } from '../components/reorder-buttons';
import { computeReorderedIds } from '../reorder';
import { updateVenueAction, reorderVenuesAction, type FormState } from './actions';

const emptyState: FormState = { error: null };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const VENUE_TYPE_LABELS: Record<Venue['type'], string> = {
  MAIN: 'Ana Mekan',
  HOTEL: 'Otel',
};

export function VenueRow({
  item,
  items,
  index,
  congressId,
  onRequestDelete,
}: {
  item: Venue;
  items: Venue[];
  index: number;
  congressId: string;
  onRequestDelete: (item: Venue) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(() => updateVenueAction.bind(null, item.id), [item.id]);
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
      const result = await reorderVenuesAction(ids);
      if (result.error) setReorderError(result.error);
    });
  }

  if (editing) {
    return (
      <tr className="content-row-editing">
        <td colSpan={5} className="content-edit-cell">
          <form action={formAction} className="content-edit-form content-form-grid">
            <label>
              Mekan adı
              <input ref={firstFieldRef} name="name" defaultValue={item.name} required minLength={1} />
            </label>
            <label>
              Tür
              <Select name="type" defaultValue={item.type}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAIN">Ana Mekan</SelectItem>
                  <SelectItem value="HOTEL">Otel</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              Adres
              <input type="text" name="address" defaultValue={item.address ?? ''} />
            </label>
            <label>
              Şehir
              <input type="text" name="city" defaultValue={item.city ?? ''} />
            </label>
            <label>
              Telefon
              <input type="tel" name="phone" defaultValue={item.phone ?? ''} />
            </label>
            <label>
              Web sitesi
              <input type="url" name="websiteUrl" defaultValue={item.websiteUrl ?? ''} />
            </label>
            <label>
              Harita bağlantısı
              <input type="url" name="mapUrl" defaultValue={item.mapUrl ?? ''} />
            </label>
            <label>
              Enlem <span className="content-form-optional">(boş bırakılırsa mevcut değer korunur)</span>
              <input
                type="text"
                inputMode="decimal"
                name="latitude"
                defaultValue={item.latitude ?? ''}
              />
            </label>
            <label>
              Boylam <span className="content-form-optional">(boş bırakılırsa mevcut değer korunur)</span>
              <input
                type="text"
                inputMode="decimal"
                name="longitude"
                defaultValue={item.longitude ?? ''}
              />
            </label>
            <label className="content-form-span-2">
              Açıklama
              <textarea name="description" rows={3} defaultValue={item.description ?? ''} />
            </label>
            <div className="content-form-span-2">
              <ImageUploadField
                label="Mekan görseli"
                name="imageUrl"
                congressId={congressId}
                purpose="venue"
                defaultValue={item.imageUrl}
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
          itemLabel={item.name}
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
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_URL}${item.imageUrl}`} alt="" className="content-thumbnail" />
        ) : (
          <div className="content-thumbnail-placeholder" aria-hidden="true" />
        )}
      </td>
      <td>
        <p className="content-cell-title">{item.name}</p>
        <p className="content-cell-subtitle">
          {[item.city, item.address].filter(Boolean).join(' · ') || '—'}
        </p>
      </td>
      <td>
        <StatusBadge tone={item.type === 'MAIN' ? 'info' : 'neutral'}>
          {VENUE_TYPE_LABELS[item.type]}
        </StatusBadge>
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
