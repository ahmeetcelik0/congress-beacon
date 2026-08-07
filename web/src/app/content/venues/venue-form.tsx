'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createVenueAction, type FormState } from './actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploadField } from '@/components/ui/image-upload-field';

const initialState: FormState = { error: null };

export function VenueForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createVenueAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  // `formRef.current?.reset()` yalnızca ham DOM alanlarını temizler -
  // `ImageUploadField`in kendi `url` state'i React tarafından yönetildiği
  // için native reset'ten ETKİLENMEZ (aksi halde bir sonraki mekan, önceki
  // mekanın görselini sessizce devralırdı). `key` değiştirilerek bileşen
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
        Mekan adı
        <input type="text" name="name" required minLength={1} placeholder="ör. Kongre Merkezi" />
      </label>
      <label>
        Tür
        <Select name="type" defaultValue="HOTEL">
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
        Adres <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="address" />
      </label>
      <label>
        Şehir <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="city" />
      </label>
      <label>
        Telefon <span className="content-form-optional">(opsiyonel)</span>
        <input type="tel" name="phone" />
      </label>
      <label>
        Web sitesi <span className="content-form-optional">(opsiyonel)</span>
        <input type="url" name="websiteUrl" placeholder="https://…" />
      </label>
      <label>
        Harita bağlantısı <span className="content-form-optional">(opsiyonel)</span>
        <input type="url" name="mapUrl" placeholder="https://maps.google.com/…" />
      </label>
      <label>
        Enlem <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" inputMode="decimal" name="latitude" placeholder="ör. 41.0082" />
      </label>
      <label>
        Boylam <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" inputMode="decimal" name="longitude" placeholder="ör. 28.9784" />
      </label>
      <label className="content-form-span-2">
        Açıklama <span className="content-form-optional">(opsiyonel)</span>
        <textarea name="description" rows={3} />
      </label>
      <div className="content-form-span-2">
        <ImageUploadField
          key={imageResetKey}
          label="Mekan görseli (opsiyonel)"
          name="imageUrl"
          congressId={congressId}
          purpose="venue"
          hint="JPEG, PNG veya WEBP — en fazla 2 MB."
        />
      </div>
      <div className="content-form-footer content-form-span-2">
        <button type="submit" disabled={pending}>
          {pending ? 'Oluşturuluyor…' : 'Mekan ekle'}
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
