import { toAbsoluteUrl } from './absolute-url';

describe('toAbsoluteUrl', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('null/undefined oldugu gibi kalir', () => {
    expect(toAbsoluteUrl(null)).toBeNull();
    expect(toAbsoluteUrl(undefined)).toBeNull();
    expect(toAbsoluteUrl('')).toBeNull();
  });

  it('APP_PUBLIC_URL tanimliyken goreli yolu mutlak URL yapar', () => {
    process.env.APP_PUBLIC_URL = 'https://beacon.photofocustr.com/api';
    expect(toAbsoluteUrl('/uploads/abc/logo.png')).toBe(
      'https://beacon.photofocustr.com/api/uploads/abc/logo.png',
    );
  });

  it('APP_PUBLIC_URL sonundaki slash temizlenir (cift slash olusmaz)', () => {
    process.env.APP_PUBLIC_URL = 'https://beacon.photofocustr.com/api/';
    expect(toAbsoluteUrl('/uploads/abc/logo.png')).toBe(
      'https://beacon.photofocustr.com/api/uploads/abc/logo.png',
    );
  });

  it('bastaki slash eksikse eklenir', () => {
    process.env.APP_PUBLIC_URL = 'https://beacon.photofocustr.com/api';
    expect(toAbsoluteUrl('uploads/abc/logo.png')).toBe(
      'https://beacon.photofocustr.com/api/uploads/abc/logo.png',
    );
  });

  it('APP_PUBLIC_URL tanimsizsa PORT uzerinden yerel varsayilan uretir', () => {
    delete process.env.APP_PUBLIC_URL;
    process.env.PORT = '3001';
    expect(toAbsoluteUrl('/uploads/abc/logo.png')).toBe(
      'http://localhost:3001/uploads/abc/logo.png',
    );
  });

  it('zaten mutlak olan (http/https) bir deger degistirilmeden doner', () => {
    process.env.APP_PUBLIC_URL = 'https://beacon.photofocustr.com/api';
    expect(toAbsoluteUrl('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png',
    );
    expect(toAbsoluteUrl('http://cdn.example.com/logo.png')).toBe(
      'http://cdn.example.com/logo.png',
    );
  });
});
