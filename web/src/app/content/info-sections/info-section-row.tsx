'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';
import type { CongressInfoSection } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { ReorderButtons } from '../components/reorder-buttons';
import { MarkdownLitePreview } from '../components/markdown-lite';
import { computeReorderedIds } from '../reorder';
import { updateInfoSectionAction, reorderInfoSectionsAction, type FormState } from './actions';

const emptyState: FormState = { error: null };
export const INFO_SECTION_COLUMN_COUNT = 4;

/**
 * NOT: Silme onayı bilinçli olarak burada DEĞİL, `info-sections-table.tsx`da
 * — `ConfirmDeleteDialog` bir `<dialog>` render eder ve `<tr>`/`<tbody>`nin
 * geçerli çocukları yalnızca `<td>`/`<tr>`dir; dialog'u satır başına burada
 * açsaydık geçersiz bir DOM yerleşimi (`<dialog>` doğrudan `<tr>` altında)
 * oluşurdu. Bunun yerine tablo düzeyinde TEK bir paylaşılan dialog vardır
 * (bkz. `registrations-table.tsx`daki aynı desen) ve bu satır yalnızca
 * `onRequestDelete` çağırır.
 */
export function InfoSectionRow({
  item,
  items,
  index,
  onRequestDelete,
}: {
  item: CongressInfoSection;
  items: CongressInfoSection[];
  index: number;
  onRequestDelete: (item: CongressInfoSection) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const boundUpdate = React.useMemo(() => updateInfoSectionAction.bind(null, item.id), [item.id]);
  const [state, formAction, pending] = useActionState(boundUpdate, emptyState);
  const [body, setBody] = React.useState(item.body);

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
      const result = await reorderInfoSectionsAction(ids);
      if (result.error) setReorderError(result.error);
    });
  }

  if (editing) {
    return (
      <tr className="content-row-editing">
        <td colSpan={INFO_SECTION_COLUMN_COUNT} className="content-edit-cell">
          <form action={formAction} className="content-edit-form">
            <label>
              Başlık
              <input ref={firstFieldRef} name="title" defaultValue={item.title} required minLength={1} />
            </label>
            <div className="content-markdown-editor">
              <label htmlFor={`info-section-body-${item.id}`}>İçerik (Markdown)</label>
              <textarea
                id={`info-section-body-${item.id}`}
                name="body"
                required
                rows={6}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <div className="content-markdown-preview-panel">
                <span className="content-markdown-preview-label">Önizleme</span>
                <MarkdownLitePreview text={body} />
              </div>
            </div>
            <label className="content-checkbox-label">
              <input type="checkbox" name="isPublished" defaultChecked={item.isPublished} />
              Yayınla (mobilde görünsün)
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
        <p className="content-cell-title">{item.title}</p>
        <p className="content-cell-subtitle">
          {item.body.slice(0, 90)}
          {item.body.length > 90 ? '…' : ''}
        </p>
      </td>
      <td>
        <StatusBadge tone={item.isPublished ? 'positive' : 'warning'}>
          {item.isPublished ? 'Yayında' : 'Taslak'}
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
