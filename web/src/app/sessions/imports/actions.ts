'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError, type ProgramImportEstimate } from '@/lib/api';

// Iki asamali yukleme akisinin ILK adimi - PARA HARCAMAZ, yalnizca token
// sayar. Dosya tarayicida (`ProgramImportPanel` state'inde) tutulur ve AYNI
// `File` nesnesi bu iki server action cagrisinda (bkz. asagisi
// `createProgramImportAction`) yeniden kullanilir - React Server Function
// argumanlari `File`/`Blob` nesnelerini native olarak destekler.
export type EstimateResult =
  | { error: null; estimate: ProgramImportEstimate }
  | { error: string; estimate: null };

export async function estimateProgramImportAction(
  congressId: string,
  file: File,
): Promise<EstimateResult> {
  try {
    const estimate = await api.estimateProgramImport(congressId, file);
    return { error: null, estimate };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Maliyet tahmini alınamadı.',
      estimate: null,
    };
  }
}

// Ikinci adim - kullanici tahmini gorup ACIK ONAY verdikten SONRA cagrilir.
// Backend aninda PENDING doner, gercek LLM cikarimi arka planda (BullMQ)
// calisir - onizleme sayfasi bunu asenkron bekler (bkz. `status-poller.tsx`).
export type CreateResult = { error: null; importId: string } | { error: string; importId: null };

export async function createProgramImportAction(
  congressId: string,
  file: File,
): Promise<CreateResult> {
  try {
    const result = await api.createProgramImport(congressId, file);
    revalidatePath('/sessions');
    return { error: null, importId: result.importId };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Dosya yüklenemedi.',
      importId: null,
    };
  }
}

// Faz 4c §2: LLM cagrisi yok, tahmin adimi yok - tek adimda yuklenir. Hata
// govdesi `{ message, errors: string[] }` (Turkce, konumlu hatalar, ör.
// "3. oturumda 'startTime' alani eksik") - tek bir genel mesaj YETERSIZ,
// kullanicinin JSON dosyasinin HANGI satirini duzeltecegini gormesi gerekir.
export type CreateJsonResult =
  | { error: null; errors: null; importId: string }
  | { error: string; errors: string[] | null; importId: null };

export async function createJsonProgramImportAction(
  congressId: string,
  file: File,
): Promise<CreateJsonResult> {
  try {
    const result = await api.createJsonProgramImport(congressId, file);
    revalidatePath('/sessions');
    return { error: null, errors: null, importId: result.importId };
  } catch (error) {
    if (error instanceof ApiError) {
      const details = error.details as { errors?: string[] } | undefined;
      return {
        error: error.message,
        errors: details?.errors ?? null,
        importId: null,
      };
    }
    return { error: 'Dosya yüklenemedi.', errors: null, importId: null };
  }
}
