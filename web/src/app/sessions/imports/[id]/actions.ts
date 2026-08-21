'use server';

import { revalidatePath } from 'next/cache';
import {
  api,
  ApiError,
  type ProgramImportApproveSummary,
  type ProgramRoleType,
} from '@/lib/api';
import { datetimeLocalToIsoOrUndefined as toIsoOrUndefined } from '@/lib/congress-time';

function refresh(importId: string) {
  revalidatePath(`/sessions/imports/${importId}`);
}

// --- Oturum satirlari ---

export type FormState = { error: string | null; saved: boolean };
export type ActionResult = { error: string | null };

export async function updateProgramImportSessionAction(
  importId: string,
  sessionId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get('title') ?? '').trim();
  const hallId = String(formData.get('hallId') ?? '').trim();
  const sessionType = String(formData.get('sessionType') ?? '').trim();
  const dayLabel = String(formData.get('dayLabel') ?? '').trim();
  const keywords = String(formData.get('keywords') ?? '').trim();

  try {
    await api.updateProgramImportSession(importId, sessionId, {
      title,
      // Bos secim GONDERILMEZ (bkz. `toIsoOrUndefined` yorumu, ayni mantik
      // hallId icin de gecerli - backend `@IsUUID()` bos string'i 400 ile
      // reddeder).
      hallId: hallId || undefined,
      startTime: toIsoOrUndefined(formData.get('startTime')),
      endTime: toIsoOrUndefined(formData.get('endTime')),
      sessionType,
      dayLabel,
      keywords,
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Oturum güncellenemedi.', saved: false };
  }

  refresh(importId);
  return { error: null, saved: true };
}

export async function excludeProgramImportSessionAction(
  importId: string,
  sessionId: string,
): Promise<ActionResult> {
  try {
    await api.excludeProgramImportSession(importId, sessionId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Oturum çıkarılamadı.' };
  }
  refresh(importId);
  return { error: null };
}

export async function createProgramImportSessionAction(
  importId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get('title') ?? '').trim();
  const hallId = String(formData.get('hallId') ?? '').trim();
  const sessionType = String(formData.get('sessionType') ?? '').trim();
  const dayLabel = String(formData.get('dayLabel') ?? '').trim();
  const keywords = String(formData.get('keywords') ?? '').trim();

  if (!title) {
    return { error: 'Başlık zorunludur.', saved: false };
  }

  try {
    await api.createProgramImportSession(importId, {
      title,
      hallId: hallId || undefined,
      startTime: toIsoOrUndefined(formData.get('startTime')),
      endTime: toIsoOrUndefined(formData.get('endTime')),
      sessionType: sessionType || undefined,
      dayLabel: dayLabel || undefined,
      keywords: keywords || undefined,
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Oturum eklenemedi.', saved: false };
  }

  refresh(importId);
  return { error: null, saved: true };
}

// --- Sunum satirlari ---

export async function updateProgramImportPresentationAction(
  importId: string,
  presentationId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get('title') ?? '').trim();

  try {
    await api.updateProgramImportPresentation(importId, presentationId, {
      title,
      startTime: toIsoOrUndefined(formData.get('startTime')),
      endTime: toIsoOrUndefined(formData.get('endTime')),
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Sunum güncellenemedi.', saved: false };
  }

  refresh(importId);
  return { error: null, saved: true };
}

export async function deleteProgramImportPresentationAction(
  importId: string,
  presentationId: string,
): Promise<ActionResult> {
  try {
    await api.deleteProgramImportPresentation(importId, presentationId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Sunum silinemedi.' };
  }
  refresh(importId);
  return { error: null };
}

export async function createProgramImportPresentationAction(
  importId: string,
  importSessionId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) {
    return { error: 'Sunum başlığı zorunludur.', saved: false };
  }

  try {
    await api.createProgramImportPresentation(importId, {
      importSessionId,
      title,
      startTime: toIsoOrUndefined(formData.get('startTime')),
      endTime: toIsoOrUndefined(formData.get('endTime')),
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Sunum eklenemedi.', saved: false };
  }

  refresh(importId);
  return { error: null, saved: true };
}

// --- Rol satirlari ---

export async function updateProgramImportRoleAction(
  importId: string,
  roleId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawName = String(formData.get('rawName') ?? '').trim();
  if (rawName.length < 2) {
    return { error: 'İsim en az 2 karakter olmalıdır.', saved: false };
  }

  try {
    await api.updateProgramImportRole(importId, roleId, { rawName });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Rol güncellenemedi.', saved: false };
  }

  refresh(importId);
  return { error: null, saved: true };
}

export async function deleteProgramImportRoleAction(
  importId: string,
  roleId: string,
): Promise<ActionResult> {
  try {
    await api.deleteProgramImportRole(importId, roleId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Rol silinemedi.' };
  }
  refresh(importId);
  return { error: null };
}

export async function createProgramImportRoleAction(
  importId: string,
  parent: { importSessionId: string } | { importPresentationId: string },
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const type = String(formData.get('type') ?? '') as ProgramRoleType;
  const rawName = String(formData.get('rawName') ?? '').trim();

  if (!type || rawName.length < 2) {
    return { error: 'Rol türü ve en az 2 karakterlik bir isim zorunludur.', saved: false };
  }

  try {
    await api.createProgramImportRole(importId, { ...parent, type, rawName });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Rol eklenemedi.', saved: false };
  }

  refresh(importId);
  return { error: null, saved: true };
}

// --- Salon otomatik oluşturma adayları (Faz 4c §3) ---

export async function excludeHallToCreateAction(
  importId: string,
  hallName: string,
): Promise<ActionResult> {
  try {
    await api.excludeHallToCreate(importId, hallName);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Salon adayı kaldırılamadı.' };
  }
  refresh(importId);
  return { error: null };
}

// --- Onay / iptal ---

export type ApproveResult =
  | { error: null; result: ProgramImportApproveSummary }
  | { error: string; result: null };

export async function approveProgramImportAction(importId: string): Promise<ApproveResult> {
  try {
    const result = await api.approveProgramImport(importId);
    refresh(importId);
    revalidatePath('/sessions');
    return { error: null, result };
  } catch (error) {
    return { error: formatApproveError(error), result: null };
  }
}

// Backend, salon eksik oturumlarda `{ message, sessions: [...] }` doner -
// hangi oturumlarin eksik oldugunu ISIMLE gostermezsek, admin 29 satirlik
// listede tek tek "Salon secilmedi" uyarisi arayip bulmak zorunda kalir.
function formatApproveError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Onaylama başarısız.';
  const sessions = (error.details as { sessions?: { title: string | null }[] } | undefined)?.sessions;
  if (!sessions || sessions.length === 0) return error.message;
  const names = sessions.map((s) => s.title ?? '(başlıksız oturum)').join(', ');
  return `${error.message}: ${names}`;
}

export async function cancelProgramImportAction(importId: string): Promise<ActionResult> {
  try {
    await api.cancelProgramImport(importId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'İptal başarısız.' };
  }
  refresh(importId);
  revalidatePath('/sessions');
  return { error: null };
}
