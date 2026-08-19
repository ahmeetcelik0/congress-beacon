import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// register-request ve forgot-password icin: varsayilan sadece-IP takibi
// yerine IP+hedef (email/telefon) ikilisini izler. Boylece ayni IP'den
// farkli hedeflere yapilan istekler birbirini limitlemez, ama tek bir
// hedefe (bir kullanicinin kutusuna) spam kod gonderimi yine engellenir.
@Injectable()
export class ThrottleByTargetGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { emailOrPhone?: unknown } | undefined;
    const target =
      typeof body?.emailOrPhone === 'string'
        ? body.emailOrPhone.trim().toLowerCase()
        : 'bilinmiyor';
    return Promise.resolve(`${String(req.ip)}:${target}`);
  }
}
