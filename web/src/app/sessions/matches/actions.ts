'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError, type RematchSummary } from '@/lib/api';

export type ActionResult = { error: string | null };

// Bu sayfa client-fetch mimarisiyle calisir (bkz. `MatchesTable`) - burada
// tetiklenen `revalidatePath('/sessions')` yalnizca `/sessions` SAYFASININ
// SSR agacini tazeler (rol rozetleri orada da gorunur), `MatchesTable`nin
// KENDI istemci state'ini ETKILEMEZ - o kendi "tick" sayacini artirarak
// yeniden ceker (bkz. proje tasarim sistemi notu).
export async function linkProgramRoleAction(roleId: string, userId: string): Promise<ActionResult> {
  try {
    await api.linkProgramRole(roleId, userId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Katılımcı bağlanamadı.' };
  }
  revalidatePath('/sessions');
  return { error: null };
}

export async function ignoreProgramRoleAction(roleId: string): Promise<ActionResult> {
  try {
    await api.ignoreProgramRole(roleId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'İşlem başarısız.' };
  }
  revalidatePath('/sessions');
  return { error: null };
}

export type RematchResult = { error: string | null; summary: RematchSummary | null };

export async function rematchProgramRolesAction(congressId: string): Promise<RematchResult> {
  try {
    const summary = await api.rematchProgramRoles(congressId);
    revalidatePath('/sessions');
    return { error: null, summary };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Yeniden eşleştirme başarısız.',
      summary: null,
    };
  }
}
