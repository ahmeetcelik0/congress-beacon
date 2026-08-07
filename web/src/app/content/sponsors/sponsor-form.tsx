'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createSponsorAction, type FormState } from './actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { SPONSOR_TIER_LABELS } from './tier-labels';
import type { SponsorTier } from '@/lib/api';

const initialState: FormState = { error: null };
const TIERS = Object.keys(SPONSOR_TIER_LABELS) as SponsorTier[];

export function SponsorForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createSponsorAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  // `formRef.current?.reset()` yalnızca ham DOM alanlarını temizler -
  // `ImageUploadField`in kendi `url` state'i React tarafından yönetildiği
  // için native reset'ten ETKİLENMEZ (aksi halde bir sonraki sponsor,
  // öncekinin logosunu sessizce devralırdı). `key` değiştirilerek bileşen
  // yeniden monte edilir, bu da state'i sıfırlar.
  const [imageResetKey, setImageResetKey] = React.useState(0);

  React.useEffect(() => {
    if (state.error) return;
    const timer = setTimeout(() => {
      formRef.current?.reset();
      setImageResetKey((key) => key + 1);
    }, 0);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="panel-form content-form-grid">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Sponsor adı
        <input type="text" name="name" required minLength={1} />
      </label>
      <label>
        Kademe
        <Select name="tier" defaultValue="SUPPORTER">
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
        Web sitesi <span className="content-form-optional">(opsiyonel)</span>
        <input type="url" name="websiteUrl" placeholder="https://…" />
      </label>
      <label className="content-form-span-2">
        Açıklama <span className="content-form-optional">(opsiyonel)</span>
        <textarea name="description" rows={3} />
      </label>
      <div className="content-form-span-2">
        <ImageUploadField
          key={imageResetKey}
          label="Sponsor logosu (opsiyonel)"
          name="logoUrl"
          congressId={congressId}
          purpose="sponsor"
          hint="JPEG, PNG veya WEBP — en fazla 2 MB."
        />
      </div>
      <div className="content-form-footer content-form-span-2">
        <button type="submit" disabled={pending}>
          {pending ? 'Oluşturuluyor…' : 'Sponsor ekle'}
        </button>
      </div>
      {state.error && (
        <p className="panel-error content-form-span-2" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
