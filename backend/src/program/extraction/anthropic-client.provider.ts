import { Logger, Provider } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_CLIENT = 'ANTHROPIC_CLIENT';

// ANTHROPIC_API_KEY tanimli degilse client `null` olur - cikarim uc
// noktalari bunu 503'e cevirir (bkz. program-imports.controller.ts),
// uygulama acilista COKMEZ. Ayni "MailModule" faktori deseni (bkz.
// mail.module.ts): gercek saglayici mi, yoksa devre-disi mi secimi
// tek bir yerde yapilir.
export const AnthropicClientProvider: Provider = {
  provide: ANTHROPIC_CLIENT,
  useFactory: (): Anthropic | null => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      new Logger('AnthropicClient').warn(
        'ANTHROPIC_API_KEY tanimli degil - program cikarimi uc noktalari 503 donecek.',
      );
      return null;
    }
    return new Anthropic({ apiKey });
  },
};
