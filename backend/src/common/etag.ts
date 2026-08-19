import { createHash } from 'node:crypto';

// Mobil, kongre boyunca nadiren degisen ama buyuk olabilen listeleri
// (ozellikle bilimsel program) her acilista yeniden indirmemeli (bkz. Faz 5
// talimati). ETag, ilgili kayitlarin SAYISI + en buyuk `updatedAt` degerinden
// turetilir - yalnizca `updatedAt`e bakmak SILME islemlerini kacirir (silinen
// bir satirin updatedAt'i artik yok), bu yuzden sayim da seed'e dahil edilir.
export function buildEtag(seed: unknown): string {
  const hash = createHash('sha1').update(JSON.stringify(seed)).digest('hex');
  return `"${hash}"`;
}
