'use client';

import { useActionState, useState } from 'react';
import { updateAlgorithmTuningAction, type TuningFormState } from '../actions';
import type { AlgorithmTuning } from '@/lib/api';

const initialState: TuningFormState = { error: null, saved: false };

type FieldSpec = {
  name: keyof AlgorithmTuning;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
};

const FIELDS: FieldSpec[] = [
  {
    name: 'entryProbabilityThreshold',
    label: 'Giriş eşiği',
    hint: 'Bu güven yüzdesini 2 ölçüm üst üste geçen salona “girildi” denir.',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    name: 'exitProbabilityThreshold',
    label: 'Çıkış eşiği',
    hint: 'Giriş eşiğinden küçük olmalı. Aradaki fark, sinyal dalgalanmasında katılımcının salondan atılmasını önler.',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    name: 'ambiguityMarginPct',
    label: 'Belirsizlik payı',
    hint: 'İlk iki salonun yüzde farkı bunun altındaysa sistem taraf seçmez.',
    min: 0,
    max: 50,
    step: 1,
  },
  {
    name: 'emaAlpha',
    label: 'Yumuşatma (EMA α)',
    hint: 'Büyüdükçe yeni ölçüme daha hızlı tepki verir, gürültüye de daha açık olur.',
    min: 0.01,
    max: 1,
    step: 0.01,
  },
  {
    name: 'confidenceTemperature',
    label: 'Güven sıcaklığı (T)',
    hint: 'Büyüdükçe salonların yüzdeleri birbirine yaklaşır.',
    min: 0.5,
    max: 50,
    step: 0.5,
  },
  {
    name: 'hampelK',
    label: 'Outlier sıkılığı (k)',
    hint: 'Küçüldükçe daha çok okuma “anormal” sayılıp elenir.',
    min: 0.5,
    max: 10,
    step: 0.1,
  },
  {
    name: 'hampelWindowSize',
    label: 'Outlier penceresi',
    hint: 'Anormallik kararında bakılan son okuma sayısı.',
    min: 3,
    max: 20,
    step: 1,
  },
  {
    name: 'staleGraceSeconds',
    label: 'Sinyal kesintisi toleransı (sn)',
    hint: 'Bir beacon geçersiz okuma dönerse, son bilinen değeri bu kadar saniye daha kullanılır — tek beacon’lu bir salonun anlık kesintisinde rakip salona sahte geçişi önler.',
    min: 0,
    max: 60,
    step: 0.5,
  },
];

export function AlgorithmTuningControl({
  congressId,
  initialValues,
}: {
  congressId: string;
  initialValues: AlgorithmTuning;
}) {
  const [state, formAction, pending] = useActionState(
    updateAlgorithmTuningAction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<AlgorithmTuning>(initialValues);

  return (
    <section className="tp-section">
      <button
        type="button"
        className="tp-raw-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '▾' : '▸'} Algoritma ayarları — salon tespiti hassasiyeti
      </button>

      {open && (
        <form action={formAction} className="tp-tuning-form">
          <input type="hidden" name="congressId" value={congressId} />

          <p className="tp-tuning-note">
            Bu değerler saha kalibrasyonu içindir. Beacon yerleşimi kötüyse
            hiçbir ayar bunu telafi etmez.
          </p>

          <div className="tp-tuning-grid">
            {FIELDS.map((field) => (
              <label key={field.name} className="tp-tuning-field">
                <span className="tp-tuning-label">{field.label}</span>
                <input
                  name={field.name}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={values[field.name]}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: Number(event.target.value),
                    }))
                  }
                />
                <span className="tp-tuning-hint">{field.hint}</span>
              </label>
            ))}
          </div>

          <div className="tp-tuning-actions">
            <button type="submit" disabled={pending} className="tp-interval-save">
              {pending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => setValues(initialValues)}
              disabled={pending}
            >
              Geri al
            </button>
            {state.error && (
              <span className="tp-interval-error">{state.error}</span>
            )}
            {!state.error && state.saved && <span>Kaydedildi.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
