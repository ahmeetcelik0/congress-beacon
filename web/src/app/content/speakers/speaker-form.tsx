'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createKeynoteSpeakerAction, type FormState } from './actions';
import { ImageUploadField } from '@/components/ui/image-upload-field';

const initialState: FormState = { error: null };

/**
 * ÖNEMLİ: Bu vitrin listesi "Bilimsel Program" (`/sessions`) sayfasındaki
 * oturum konuşmacılarıyla HİÇBİR İLİŞKİSİ YOK — ayrı, elle yönetilen bir
 * liste (bkz. görev tanımı). Formda bilinçli olarak sessions'a bir
 * referans/link YOK.
 */
export function SpeakerForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createKeynoteSpeakerAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  // `formRef.current?.reset()` yalnızca ham DOM alanlarını temizler -
  // `ImageUploadField`in kendi `url` state'i React tarafından yönetildiği
  // için native reset'ten ETKİLENMEZ (aksi halde bir sonraki konuşmacı,
  // öncekinin fotoğrafını sessizce devralırdı). `key` değiştirilerek bileşen
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
        Ad soyad
        <input type="text" name="fullName" required minLength={1} />
      </label>
      <label>
        Unvan <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="title" placeholder="ör. Prof. Dr." />
      </label>
      <label>
        Kurum <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="institution" />
      </label>
      <label>
        Ülke <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="country" />
      </label>
      <label className="content-form-span-2">
        Biyografi <span className="content-form-optional">(opsiyonel)</span>
        <textarea name="bio" rows={3} />
      </label>
      <div className="content-form-span-2">
        <ImageUploadField
          key={imageResetKey}
          label="Fotoğraf (opsiyonel)"
          name="photoUrl"
          congressId={congressId}
          purpose="speaker"
          hint="JPEG, PNG veya WEBP — en fazla 2 MB."
        />
      </div>
      <div className="content-form-footer content-form-span-2">
        <button type="submit" disabled={pending}>
          {pending ? 'Oluşturuluyor…' : 'Konuşmacı ekle'}
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
