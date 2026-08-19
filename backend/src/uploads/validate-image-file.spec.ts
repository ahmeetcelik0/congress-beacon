import { detectImageType } from './validate-image-file';

function bytes(...values: number[]): Buffer {
  return Buffer.from(values);
}

describe('detectImageType', () => {
  it('gercek bir JPEG imzasini taniir', () => {
    const buffer = Buffer.concat([
      bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0),
      Buffer.alloc(20),
    ]);
    expect(detectImageType(buffer)).toBe('image/jpeg');
  });

  it('gercek bir PNG imzasini taniir', () => {
    const buffer = Buffer.concat([
      bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0),
      Buffer.alloc(20),
    ]);
    expect(detectImageType(buffer)).toBe('image/png');
  });

  it('gercek bir WEBP imzasini taniir', () => {
    const buffer = Buffer.concat([
      bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
      Buffer.alloc(20),
    ]);
    expect(detectImageType(buffer)).toBe('image/webp');
  });

  it('.png uzantili ama gercekte metin olan bir dosyayi REDDEDER', () => {
    const buffer = Buffer.from('bu aslinda sadece duz metin, gorsel degil');
    expect(detectImageType(buffer)).toBeNull();
  });

  it('bir PDF imzasini reddeder', () => {
    // %PDF-1.4
    const buffer = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(20)]);
    expect(detectImageType(buffer)).toBeNull();
  });

  it('cok kisa/bos bir dosyayi reddeder', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
