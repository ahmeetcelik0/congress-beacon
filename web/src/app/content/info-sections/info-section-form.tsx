'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createInfoSectionAction, type FormState } from './actions';
import { MarkdownLitePreview } from '../components/markdown-lite';

const initialState: FormState = { error: null };

export function InfoSectionForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createInfoSectionAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [body, setBody] = React.useState('');

  React.useEffect(() => {
    if (!state.error) {
      // Basarili gonderimde formu temizle (bkz. `congress-form.tsx`'teki ayni desen).
      const timer = setTimeout(() => {
        formRef.current?.reset();
        setBody('');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="panel-form content-form-stacked">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Başlık
        <input type="text" name="title" required minLength={1} placeholder="ör. Kongre Hakkında" />
      </label>
      <div className="content-markdown-editor">
        <label htmlFor="info-section-body">
          İçerik (Markdown desteklenir: # başlık, **kalın**, - madde listesi)
        </label>
        <textarea
          id="info-section-body"
          name="body"
          required
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={'## Katılım koşulları\nBu kongre yalnızca kayıtlı katılımcılara açıktır.\n\n- Yaka kartı zorunludur\n- **Salon değişiklikleri** duyurular sekmesinden takip edilebilir'}
        />
        <div className="content-markdown-preview-panel">
          <span className="content-markdown-preview-label">Önizleme</span>
          <MarkdownLitePreview text={body} />
        </div>
      </div>
      <label className="content-checkbox-label">
        <input type="checkbox" name="isPublished" />
        Yayınla (mobilde hemen görünsün)
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor…' : 'Bilgi bölümü ekle'}
      </button>
      {state.error && (
        <p className="panel-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
