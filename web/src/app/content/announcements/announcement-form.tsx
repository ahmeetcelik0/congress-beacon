'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createAnnouncementAction, type FormState } from './actions';

const initialState: FormState = { error: null };

export function AnnouncementForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createAnnouncementAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.error) return;
    const timer = setTimeout(() => formRef.current?.reset(), 0);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="panel-form content-form-stacked">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Başlık
        <input type="text" name="title" required minLength={1} placeholder="ör. Salon B değişikliği" />
      </label>
      <label>
        İçerik
        <textarea name="body" required rows={4} placeholder="Duyuru metni…" />
      </label>
      <label className="content-checkbox-label">
        <input type="checkbox" name="isPinned" />
        Sabitle (listenin en üstünde göster)
      </label>
      <p className="content-form-hint">
        Yeni duyuru taslak olarak eklenir; listeden &quot;Yayınla&quot; ile mobilde görünür hâle
        getirebilirsiniz.
      </p>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor…' : 'Duyuru ekle'}
      </button>
      {state.error && (
        <p className="panel-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
