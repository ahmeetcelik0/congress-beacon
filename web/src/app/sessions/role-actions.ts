'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError, type ProgramRoleType } from '@/lib/api';

export type FormState = { error: string | null };
export type ActionResult = { error: string | null };

// `parent` `useActionState` icin `.bind(null, parent)` ile onceden baglanir
// (bkz. `RoleManager`) - sessionId/presentationId'den TAM OLARAK biri
// gonderilir, backend ikisi de dolu/bos gelirse 400 doner.
export async function createRoleAction(
  parent: { sessionId: string } | { presentationId: string },
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const type = String(formData.get('type') ?? '') as ProgramRoleType;
  const rawName = String(formData.get('rawName') ?? '').trim();

  if (!type || !rawName) {
    return { error: 'Rol türü ve isim zorunludur.' };
  }

  try {
    await api.createProgramRole({ ...parent, type, rawName });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Rol eklenemedi.' };
  }

  revalidatePath('/sessions');
  return { error: null };
}

export async function deleteRoleAction(id: string): Promise<ActionResult> {
  try {
    await api.deleteProgramRole(id);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Rol silinemedi.' };
  }
  revalidatePath('/sessions');
  return { error: null };
}
