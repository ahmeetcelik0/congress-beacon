'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';
import type { Sponsor, SponsorTier } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { ReorderButtons } from '../components/reorder-buttons';
import { computeReorderedIds } from '../reorder';
import { updateSponsorAction, reorderSponsorsAction, type FormState } from './actions';
import { SPONSOR_TIER_LABELS, SPONSOR_TIER_TONES } from './tier-labels';

const emptyState: FormState = { error: null };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TIERS = Object.keys(SPONSOR_TIER_LABELS) as SponsorTier[];

export function SponsorRow({
  item,
  items,
  index,
  congressId,
  onRequestDelete,
}: {
  item: Sponsor;
  items: Sponsor[];
  index: number;
  congressId: string;
  onRequestDelete: (item: Sponsor) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(() => updateSponsorAction.bind(null, item.id), [item.id]);
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
      const result = await reorderSponsorsAction(ids);
      if (result.error) setReorderError(result.error);
    });
  }

  if (editing) {
    return (
      <tr className="content-row-editing">
        <td colSpan={5} className="content-edit-cell">
          <form action={formAction} className="content-edit-form content-form-grid">
            <label>
              Sponsor adı
              <input ref={firstFieldRef} name="name" defaultValue={item.name} required minLength={1} />
            </label>
            <label>
              Kademe
              <Select name="tier" defaultValue={item.tier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {SPONSOR_TIER_LABELS[tier]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Web sitesi
              <input type="url" name="websiteUrl" defaultValue={item.websiteUrl ?? ''} />
            </label>
            <label className="content-form-span-2">
              Açıklama
              <textarea name="description" rows={3} defaultValue={item.description ?? ''} />
            </label>
            <div className="content-form-span-2">
              <ImageUploadField
                label="Sponsor logosu"
                name="logoUrl"
                congressId={congressId}
                purpose="sponsor"
                defaultValue={item.logoUrl}
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
        {/* Liste her zaman tier sonra displayOrder'a göre sıralı gelir (bkz.
            backend sponsors.service.ts) - bir tier sınırındaki komşuyla yer
            değiştirmek reorder isteğini gönderir ama liste yeniden
            sıralandığında görünür sıra DEĞİŞMEZ (tier alanı ayrı). Buton bu
            durumda aktif bırakılırsa kullanıcıya "hiçbir şey olmadı" izlenimi
            verir - bu yüzden tier sınırında devre dışı bırakılır. */}
        <ReorderButtons
          itemLabel={item.name}
          onMoveUp={() => handleMove('up')}
          onMoveDown={() => handleMove('down')}
          disabledUp={index === 0 || items[index - 1].tier !== item.tier}
          disabledDown={index === items.length - 1 || items[index + 1].tier !== item.tier}
          pending={reorderPending}
        />
        {reorderError && (
          <p className="panel-error content-row-error" role="alert">
            {reorderError}
          </p>
        )}
      </td>
      <td>
        {item.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_URL}${item.logoUrl}`} alt="" className="content-thumbnail" />
        ) : (
          <div className="content-thumbnail-placeholder" aria-hidden="true" />
        )}
      </td>
      <td>
        <p className="content-cell-title">{item.name}</p>
        {item.websiteUrl && <p className="content-cell-subtitle">{item.websiteUrl}</p>}
      </td>
      <td>
        <StatusBadge tone={SPONSOR_TIER_TONES[item.tier]}>{SPONSOR_TIER_LABELS[item.tier]}</StatusBadge>
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
