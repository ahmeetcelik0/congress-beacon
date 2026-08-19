// Faz 10: e-posta icerigini (konu/HTML/duz metin) `SmtpMailSender`den AYRI,
// SAF bir fonksiyona cikarir - nodemailer transporter'ini mock'lamadan
// (bkz. verification-code-email.spec.ts) icerigin dogrulugunu test etmeyi
// saglar. Basit ve TEK RENKLI HTML (agir bir sablon motoru KURULMADI) -
// kod BUYUK ve secilebilir (duz metin, resim DEGIL), duz metin alternatifi
// AYRI gonderilir (bazi istemciler HTML gostermez).
export type VerificationCodeEmail = {
  subject: string;
  text: string;
  html: string;
};

const BRAND_COLOR = '#1E4FD8';

export function buildVerificationCodeEmail(
  code: string,
): VerificationCodeEmail {
  const subject = 'Kongre Beacon giriş kodunuz';

  const text = [
    'Kongre Beacon uygulamasına giriş yapmak için aşağıdaki kodu kullanın:',
    '',
    code,
    '',
    'Bu kod, uygulamadaki şifre alanına girilir ve tek kullanımlıktır.',
    'Bu kodu kimseyle paylaşmayın.',
    '',
    'Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; hesabınızda herhangi bir değişiklik yapılmadı.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:0;background-color:#F5F6FB;font-family:Arial,Helvetica,sans-serif;">
    <!-- Faz 10 dogrulama turu: gizli "preheader" metni - HEM gelen kutusu
         onizleme satirinin anlamli olmasini saglar HEM DE (asil sebep)
         Gmail iOS uygulamasinin "..." ile katlanmis/yuklenmemis gorunum
         gostermesini onler. Gercek cihazda dogrulandi: Brevo'nun SMTP
         relay'i her e-postaya kendi acik-izleme pikselini + MSO kosullu
         yorum bloğunu body'nin EN BASINA ekliyor (Brevo hesap ayarlarindan
         KAPATILAMAZ, bkz. community.brevo.com "No Way to Disable... in
         Transactional E-Mail") - govdenin basinda GERCEK, gorunur metin
         OLMAYINCA Gmail'in mobil uygulamasi ilk render'da icerigi
         "..." ile katlanmis gosterip dokunmayi bekliyordu (Gmail masaustu
         web ve Outlook mobil BU SORUNU YASAMIYORDU - yalnizca Gmail iOS
         uygulamasina ozgu). Bu blok, Brevo'nun enjeksiyonundan ONCE,
         govdenin ILK icerigi olarak durur. -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F6FB;">
      Kongre Beacon giriş kodunuz: ${code}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F6FB;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;padding:32px;max-width:480px;">
            <tr>
              <td style="font-size:16px;font-weight:700;color:${BRAND_COLOR};padding-bottom:16px;">
                Kongre Beacon
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#141A33;line-height:1.5;padding-bottom:20px;">
                Kongre Beacon uygulamasına giriş yapmak için aşağıdaki kodu kullanın:
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:6px;color:${BRAND_COLOR};background-color:#E7ECFB;border-radius:8px;padding:12px 24px;">${code}</span>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#5B6178;line-height:1.5;padding-bottom:12px;">
                Bu kod, uygulamadaki şifre alanına girilir ve tek kullanımlıktır. Bu kodu kimseyle paylaşmayın.
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#9BA0B4;line-height:1.5;border-top:1px solid #E2E6F0;padding-top:16px;">
                Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; hesabınızda herhangi bir değişiklik yapılmadı.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
