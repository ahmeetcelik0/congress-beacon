import { buildVerificationCodeEmail } from './verification-code-email';

describe('buildVerificationCodeEmail', () => {
  it('konu satiri net ve sabit', () => {
    const email = buildVerificationCodeEmail('123456');
    expect(email.subject).toBe('Kongre Beacon giriş kodunuz');
  });

  it('kod hem duz metinde hem HTML govdesinde gecer', () => {
    const email = buildVerificationCodeEmail('482913');
    expect(email.text).toContain('482913');
    expect(email.html).toContain('482913');
  });

  it('duz metin alternatifi HTML etiketi ICERMEZ (bazi istemciler HTML gostermez)', () => {
    const email = buildVerificationCodeEmail('111222');
    expect(email.text).not.toMatch(/<[a-z]+[^>]*>/i);
  });

  it('duz metinde kodun ne ise yaradigi ve paylasilmamasi gerektigi anlatilir', () => {
    const email = buildVerificationCodeEmail('333444');
    expect(email.text).toMatch(/giriş yapmak için/);
    expect(email.text).toMatch(/kimseyle paylaşmayın/);
  });

  it('kullanici istegi yapmadiysa ne yapmasi gerektigi belirtilir', () => {
    const email = buildVerificationCodeEmail('555666');
    expect(email.text).toMatch(/siz yapmadıysanız/);
    expect(email.html).toMatch(/siz yapmadıysanız/);
  });

  it('HTML govdesi TEK RENKLI/basit kalir - agir bir sablon motoru ciktisi degildir', () => {
    const email = buildVerificationCodeEmail('777888');
    // Yalnizca inline stil kullanir, harici stylesheet/font/script YOKTUR.
    expect(email.html).not.toContain('<link');
    expect(email.html).not.toContain('<script');
    expect(email.html).not.toContain('@import');
  });

  it('her cagri icin farkli kod, farkli govde uretir (statik/onbellekli sablon degil)', () => {
    const first = buildVerificationCodeEmail('100000');
    const second = buildVerificationCodeEmail('999999');
    expect(first.html).not.toBe(second.html);
    expect(first.text).not.toBe(second.text);
  });

  it('gizli on-basmi (preheader) govdenin EN BASINDA yer alir - Gmail iOS uygulamasinin katlanmis "..." gostermesini onlemek icin (gercek cihazda dogrulandi, bkz. docs/decisions.md "Faz 10")', () => {
    const email = buildVerificationCodeEmail('246810');
    const bodyIndex = email.html.indexOf('<body');
    const preheaderIndex = email.html.indexOf('display:none;max-height:0');
    const visibleTableIndex = email.html.indexOf('<table');
    expect(bodyIndex).toBeGreaterThan(-1);
    expect(preheaderIndex).toBeGreaterThan(bodyIndex);
    // On-basim, gorunur icerigin (ilk <table>) ONCESINDE olmali - Brevo'nun
    // SMTP relay'de her govdenin basina enjekte ettigi acik-izleme
    // pikselinden/kosullu yorum blogundan ONCE gelecek konumda durmali.
    expect(preheaderIndex).toBeLessThan(visibleTableIndex);
    expect(email.html).toContain('246810');
  });
});
