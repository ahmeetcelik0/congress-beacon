'use client';

import { useActionState } from 'react';
import { updateHallCapacityAction, type CapacityFormState } from './actions';
import './hall-capacity-control.css';

const initialState: CapacityFormState = { error: null, saved: false };

/**
 * Mevcut bir salonun kapasitesini yerinde (satır içi) düzenlemek için küçük
 * form. `ObservationIntervalControl` (attendance sayfası) ile aynı desen:
 * `useActionState` + gizli id alanı + `{error, saved}` durumu — ayrı bir
 * dialog/modal AÇILMAZ, çünkü tek bir sayısal alanı düzenlemek için satır
 * içi form zaten erişilebilir ve yeterlidir.
 */
export function HallCapacityControl({
  hallId,
  initialCapacity,
}: {
  hallId: string;
  initialCapacity: number | null;
}) {
  const [state, formAction, pending] = useActionState(updateHallCapacityAction, initialState);
  const inputId = `hall-capacity-${hallId}`;

  return (
    <form action={formAction} className="hall-capacity-control">
      <input type="hidden" name="hallId" value={hallId} />
      <label htmlFor={inputId} className="hall-capacity-control-label">
        Kapasite
      </label>
      <div className="hall-capacity-control-row">
        <input
          id={inputId}
          name="capacity"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          defaultValue={initialCapacity ?? ''}
          placeholder="örn. 250"
          aria-invalid={state.error ? true : undefined}
          className="hall-capacity-control-input"
        />
        <span className="hall-capacity-control-unit">kişi</span>
        <button type="submit" disabled={pending} className="hall-capacity-control-save">
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
      {state.error && (
        <span className="hall-capacity-control-error" role="alert">
          {state.error}
        </span>
      )}
      {!state.error && state.saved && (
        <span className="hall-capacity-control-success" role="status">
          Kaydedildi.
        </span>
      )}
    </form>
  );
}
