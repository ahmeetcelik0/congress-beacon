'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createSessionAction, type FormState } from './session-actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SESSION_TYPE_SUGGESTIONS } from './session-type-options';

const initialState: FormState = { error: null };

// `speaker` alani DEPRECATED (bkz. api.ts yorumu) - yeni formda YER ALMAZ,
// moderator/konusmaci artik ProgramRole uzerinden oturum karti icinden
// eklenir (bkz. `RoleManager`). `keywords` alani KAYDEDILIYOR ama bu fazda
// HICBIR YERDE OKUNMUYOR/KULLANILMIYOR (Faz 9 bildirim hedeflemesi icin
// hazirlik) - bu yuzden opsiyonel ve dusuk vurgulu. `displayOrder` forma
// KONMAZ, yalnizca sirlama butonlariyla degisir.
export function SessionForm({
  congressId,
  halls,
}: {
  congressId: string;
  halls: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createSessionAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.error) return;
    const timer = setTimeout(() => formRef.current?.reset(), 0);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="panel-form sessions-create-form">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Salon
        <Select name="hallId" required>
          <SelectTrigger>
            <SelectValue placeholder="Salon seçin" />
          </SelectTrigger>
          <SelectContent>
            {halls.map((hall) => (
              <SelectItem key={hall.id} value={hall.id}>
                {hall.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label>
        Başlık
        <input type="text" name="title" required minLength={2} />
      </label>
      <label>
        Oturum türü <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="sessionType" list="sessions-type-suggestions" placeholder="ör. Panel" />
        <datalist id="sessions-type-suggestions">
          {SESSION_TYPE_SUGGESTIONS.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </label>
      <label>
        Gün etiketi <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="dayLabel" placeholder="ör. 1. Gün" />
      </label>
      <label>
        Başlangıç
        <input type="datetime-local" name="startTime" required />
      </label>
      <label>
        Bitiş
        <input type="datetime-local" name="endTime" required />
      </label>
      <label>
        Açıklama <span className="content-form-optional">(opsiyonel)</span>
        <input type="text" name="description" />
      </label>
      <label>
        Anahtar kelimeler <span className="content-form-optional">(opsiyonel, virgülle ayırın)</span>
        <input type="text" name="keywords" placeholder="ör. kardiyoloji, ritim" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor...' : 'Oturum oluştur'}
      </button>
      {state.error && (
        <p className="panel-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
