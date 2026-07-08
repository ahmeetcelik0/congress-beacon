'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_TOKEN_COOKIE_NAME } from '@/lib/admin-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type FormState = { error: string | null };

export async function adminLoginAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'E-posta ve şifre zorunludur.' };
  }

  const response = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  if (!response.ok) {
    return { error: 'E-posta veya şifre hatalı.' };
  }

  const data = (await response.json()) as { accessToken: string };
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_TOKEN_COOKIE_NAME, data.accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  redirect('/congresses');
}

export async function adminLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_TOKEN_COOKIE_NAME);
  redirect('/admin/login');
}
