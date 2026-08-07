// Uzantiya GUVENILMEZ - dosyanin ilk baytlarini (magic bytes) okuyup
// gercekten iddia ettigi gorsel turu oldugunu dogrular. `.png` uzantili
// bir betik (veya ic ice baska bir format) burada kabul edilmez.
export type DetectedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export const EXTENSION_BY_IMAGE_TYPE: Record<DetectedImageType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: baytlar 0-3 'RIFF', baytlar 8-11 'WEBP' (aradaki 4 bayt dosya
  // boyutu - format kontrolu icin onemli degil).
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}
