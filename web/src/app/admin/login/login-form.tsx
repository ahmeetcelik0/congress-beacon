'use client';

import { useActionState } from 'react';
import { adminLoginAction, type FormState } from './actions';

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <label>
        E-posta
        <input type="email" name="email" required autoComplete="username" />
      </label>
      <label>
        Şifre
        <input type="password" name="password" required autoComplete="current-password" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Giriş yapılıyor...' : 'Giriş yap'}
      </button>
      {state.error && <p className="panel-error">{state.error}</p>}
    </form>
  );
}
