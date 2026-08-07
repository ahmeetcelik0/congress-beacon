'use client';

import { useActionState } from 'react';
import { uploadRegistrationImportAction, type UploadFormState } from './actions';

const initialState: UploadFormState = { error: null };

/**
 * Excel/CSV toplu yükleme formu. Başarılı olursa server action doğrudan
 * `/registrations/imports/[id]` sayfasına yönlendirir (`redirect()`) - bu
 * yüzden burada ayrı bir başarı mesajı/reset mantığı yok, yalnızca hata
 * durumu gösterilir. Dosya girdisi olduğu için `<form>` `FormData`'yı
 * native olarak taşır (bkz. Next.js Server Actions "forms" rehberi).
 */
export function ImportUploadForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(uploadRegistrationImportAction, initialState);

  return (
    <form action={formAction} className="reg-upload-form">
      <input type="hidden" name="congressId" value={congressId} />
      <label className="reg-upload-form-label">
        Excel/CSV yükle
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls,.csv"
          required
          aria-describedby="reg-upload-hint"
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Yükleniyor…' : 'Yükle'}
      </button>
      <span id="reg-upload-hint" className="reg-upload-form-hint">
        .xlsx, .xls veya .csv — en fazla 5 MB
      </span>
      {state.error && (
        <p className="panel-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
