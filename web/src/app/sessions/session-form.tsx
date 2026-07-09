'use client';

import { useActionState } from 'react';
import { createSessionAction, type FormState } from './actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialState: FormState = { error: null };

export function SessionForm({
  congressId,
  halls,
}: {
  congressId: string;
  halls: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createSessionAction, initialState);

  return (
    <form action={formAction} className="panel-form">
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
        Konuşmacı (opsiyonel)
        <input type="text" name="speaker" />
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
        Açıklama (opsiyonel)
        <input type="text" name="description" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor...' : 'Oturum oluştur'}
      </button>
      {state.error && <p className="panel-error">{state.error}</p>}
    </form>
  );
}
