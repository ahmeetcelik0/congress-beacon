'use client';

import { useActionState, useState } from 'react';
import { updateObservationIntervalAction, type IntervalFormState } from '../actions';

const initialState: IntervalFormState = { error: null };

export function ObservationIntervalControl({
  congressId,
  initialValue,
}: {
  congressId: string;
  initialValue: number;
}) {
  const [state, formAction, pending] = useActionState(updateObservationIntervalAction, initialState);
  const [value, setValue] = useState(initialValue);

  return (
    <form action={formAction} className="tp-interval-control">
      <input type="hidden" name="congressId" value={congressId} />
      <label htmlFor="observationIntervalSeconds" className="tp-interval-label">
        Mobil gönderim aralığı
      </label>
      <input
        id="observationIntervalSeconds"
        name="observationIntervalSeconds"
        type="number"
        min={5}
        max={300}
        step={1}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="tp-interval-input"
      />
      <span className="tp-interval-suffix">sn</span>
      <button type="submit" disabled={pending} className="tp-interval-save">
        {pending ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
      {state.error && <span className="tp-interval-error">{state.error}</span>}
    </form>
  );
}
