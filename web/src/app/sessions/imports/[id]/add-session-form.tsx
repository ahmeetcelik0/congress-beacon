'use client';

import * as React from 'react';
import { useActionState } from 'react';
import type { Hall } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProgramImportSessionAction, type FormState } from './actions';

const initialState: FormState = { error: null, saved: false };

/**
 * LLM'in belgede atladığı bir oturumu yetkilinin elle staging'e eklemesi
 * için form. Manuel eklenen satır her zaman `status=NEW` ile başlar (bkz.
 * backend `CreateProgramImportSessionDto` yorumu).
 */
export function AddSessionForm({ importId, halls }: { importId: string; halls: Hall[] }) {
  const boundCreate = React.useMemo(
    () => createProgramImportSessionAction.bind(null, importId),
    [importId],
  );
  const [state, formAction, pending] = useActionState(boundCreate, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.error) return;
    const timer = setTimeout(() => formRef.current?.reset(), 0);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <details className="import-add-session-details">
      <summary>Belgede atlanan bir oturumu elle ekle</summary>
      <form ref={formRef} action={formAction} className="panel-form import-add-session-form">
        <label>
          Başlık
          <input type="text" name="title" required minLength={2} />
        </label>
        <label>
          Salon <span className="content-form-optional">(opsiyonel)</span>
          <Select name="hallId">
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
          Gün etiketi <span className="content-form-optional">(opsiyonel)</span>
          <input type="text" name="dayLabel" placeholder="ör. 1. Gün" />
        </label>
        <label>
          Oturum türü <span className="content-form-optional">(opsiyonel)</span>
          <input type="text" name="sessionType" placeholder="ör. Panel" />
        </label>
        <label>
          Başlangıç <span className="content-form-optional">(opsiyonel)</span>
          <input type="datetime-local" name="startTime" />
        </label>
        <label>
          Bitiş <span className="content-form-optional">(opsiyonel)</span>
          <input type="datetime-local" name="endTime" />
        </label>
        <label>
          Anahtar kelimeler <span className="content-form-optional">(opsiyonel)</span>
          <input type="text" name="keywords" placeholder="ör. kardiyoloji, ritim" />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Ekleniyor…' : 'Oturum ekle'}
        </button>
        {state.error && (
          <p className="panel-error" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
