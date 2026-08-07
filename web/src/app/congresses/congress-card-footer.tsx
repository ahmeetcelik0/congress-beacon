'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import type { Congress } from '@/lib/api';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { CongressDeleteButton } from './congress-delete-button';
import { updateCongressMetaAction, type MetaFormState } from './actions';
import './congress-form.css';
import './congress-card-footer.css';

const initialState: MetaFormState = { error: null, saved: false };

/**
 * Kart alt bilgisi: gezinme linkleri + "Düzenle" aç/kapa düğmesi + (açıksa)
 * kongrenin "profil" alanlarının (kapak görseli, açıklama, iletişim bilgisi
 * vb. — mobil ana ekranda gösterilecek "tanıtım" alanları, KİMLİK alanları
 * DEĞİL) düzenlendiği form. TEK bir istemci bileşeninde toplanmasının nedeni:
 * `open` durumu hem düğmeye hem panele aynı anda lazım, `CongressCard` bir
 * Sunucu Bileşeni olduğu için `useState`i burada TUTAMAZ; panel ayrıca
 * `.congress-card-actions`daki flex satırının DIŞINA (kartın normal blok
 * akışına) yerleştirilir — flex satırının İÇİNDE tam genişlikte bir panel
 * olsaydı kapalıyken bile "Sil" düğmesini bir alt satıra düşürürdü (bkz.
 * `.ui-collapsible`in kapalıyken de DOM'da 0 yükseklikte ama tam genişlikte
 * kalması, `collapsible.css`).
 */
export function CongressCardFooter({ congress }: { congress: Congress }) {
  const [open, setOpen] = React.useState(false);
  const boundUpdate = React.useMemo(
    () => updateCongressMetaAction.bind(null, congress.id),
    [congress.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);
  const panelId = `congress-edit-panel-${congress.id}`;

  return (
    <>
      <div className="congress-card-actions">
        <Link href={`/halls?congressId=${congress.id}`} className="congress-card-action">
          Salonlar
        </Link>
        <Link href={`/beacons?congressId=${congress.id}`} className="congress-card-action">
          Beacon&apos;lar
        </Link>
        <Link href={`/content?congressId=${congress.id}`} className="congress-card-action">
          İçerik
        </Link>
        <button
          type="button"
          className="congress-card-action"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Düzenlemeyi kapat' : 'Düzenle'}
        </button>
        <CongressDeleteButton congressId={congress.id} congressName={congress.name} />
      </div>

      <CollapsibleRegion id={panelId} open={open} innerClassName="congress-edit-panel">
        <form action={formAction} className="congress-edit-form">
          <div className="congress-form-grid">
            <label>
              Görünen tam ad <span className="congress-form-optional">(opsiyonel)</span>
              <input
                type="text"
                name="fullName"
                defaultValue={congress.fullName ?? ''}
                placeholder={congress.name}
              />
            </label>
            <label>
              Web sitesi <span className="congress-form-optional">(opsiyonel)</span>
              <input
                type="url"
                name="websiteUrl"
                defaultValue={congress.websiteUrl ?? ''}
                placeholder="https://…"
              />
            </label>
            <label>
              İletişim e-postası <span className="congress-form-optional">(opsiyonel)</span>
              <input type="email" name="contactEmail" defaultValue={congress.contactEmail ?? ''} />
            </label>
            <label>
              İletişim telefonu <span className="congress-form-optional">(opsiyonel)</span>
              <input type="tel" name="contactPhone" defaultValue={congress.contactPhone ?? ''} />
            </label>
            <label className="congress-edit-form-span-2">
              Açıklama <span className="congress-form-optional">(opsiyonel)</span>
              <textarea name="description" rows={3} defaultValue={congress.description ?? ''} />
            </label>
            <div className="congress-edit-form-span-2">
              <ImageUploadField
                label="Kapak görseli (opsiyonel)"
                name="coverImageUrl"
                congressId={congress.id}
                purpose="cover"
                defaultValue={congress.coverImageUrl}
                hint="Mobil ana ekranda kongre kartında gösterilir — JPEG, PNG veya WEBP, en fazla 2 MB."
              />
            </div>
          </div>

          <div className="congress-form-footer">
            <p className="congress-form-hint">Boş bırakılan alanlar temizlenir.</p>
            <button type="submit" disabled={pending}>
              {pending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>

          {state.error && (
            <p className="congress-form-error" role="alert">
              {state.error}
            </p>
          )}
          {!state.error && state.saved && (
            <p className="congress-form-success" role="status">
              Kaydedildi.
            </p>
          )}
        </form>
      </CollapsibleRegion>
    </>
  );
}
