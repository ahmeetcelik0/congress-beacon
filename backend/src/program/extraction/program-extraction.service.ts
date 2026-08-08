import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_CLIENT } from './anthropic-client.provider';
import {
  getAnthropicModel,
  getAnthropicMaxOutputTokens,
} from './anthropic-config';
import {
  PROGRAM_EXTRACTION_SYSTEM_PROMPT,
  PROGRAM_EXTRACTION_USER_INSTRUCTION,
} from './extraction-system-prompt';
import {
  PROGRAM_EXTRACTION_JSON_SCHEMA,
  ExtractionResult,
} from './extraction-schema';
import { prepareDocumentContent } from './prepare-extraction-input';
import { ProgramSourceType } from '../../../generated/prisma/client';

export type TokenEstimate = {
  inputTokens: number;
  model: string;
};

export type ExtractionOutcome = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  result: ExtractionResult;
};

const NO_API_KEY_MESSAGE =
  'Program çıkarımı için API anahtarı yapılandırılmamış';

// LLM cagrisinin tek giris noktasi. `estimate` (token sayimi, para
// harcamaz) ve `extract` (gercek cikarim, streaming zorunlu - bkz. Faz 4b
// talimati "150 sayfalik belgede cikti 100K token'a yaklasabilir ve
// streaming olmadan HTTP zaman asimina duser") AYNI mesaj gövdesini
// (buildMessages) kullanir ki tahmin edilen token sayisi gercek cagriyla
// tutarli olsun.
@Injectable()
export class ProgramExtractionService {
  private readonly logger = new Logger(ProgramExtractionService.name);

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly client: Anthropic | null,
  ) {}

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): Anthropic {
    if (!this.client) {
      throw new ServiceUnavailableException(NO_API_KEY_MESSAGE);
    }
    return this.client;
  }

  private buildMessages(
    sourceType: ProgramSourceType,
    buffer: Buffer,
  ): Anthropic.MessageParam[] {
    const documentContent = prepareDocumentContent(sourceType, buffer);
    return [
      {
        role: 'user',
        content: [
          ...documentContent,
          { type: 'text', text: PROGRAM_EXTRACTION_USER_INSTRUCTION },
        ],
      },
    ];
  }

  // Yalnizca INPUT token sayimi yapar - `countTokens` ucretsizdir, para
  // harcamaz (bkz. Faz 4b talimati "Bu uc nokta cikarim yapmaz").
  async countInputTokens(
    sourceType: ProgramSourceType,
    buffer: Buffer,
  ): Promise<TokenEstimate> {
    const client = this.requireClient();
    const model = getAnthropicModel();

    const response = await client.messages.countTokens({
      model,
      system: PROGRAM_EXTRACTION_SYSTEM_PROMPT,
      messages: this.buildMessages(sourceType, buffer),
    });

    return { inputTokens: response.input_tokens, model };
  }

  async extract(
    sourceType: ProgramSourceType,
    buffer: Buffer,
  ): Promise<ExtractionOutcome> {
    const client = this.requireClient();
    const model = getAnthropicModel();
    const maxTokens = getAnthropicMaxOutputTokens();

    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: PROGRAM_EXTRACTION_SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: {
          type: 'json_schema',
          schema: PROGRAM_EXTRACTION_JSON_SCHEMA,
        },
      },
      messages: this.buildMessages(sourceType, buffer),
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new Error(
        'Model belgeyi islemeyi reddetti (guvenlik siniflandiricisi). Belgeyi kontrol edip tekrar deneyin.',
      );
    }

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    if (!textBlock) {
      throw new Error('Model beklenen yapilandirilmis ciktiyi dondurmedi.');
    }

    let parsed: ExtractionResult;
    try {
      parsed = JSON.parse(textBlock.text) as ExtractionResult;
    } catch {
      throw new Error('Model ciktisi gecerli JSON degil.');
    }

    this.logger.log(
      `Cikarim tamamlandi: model=${message.model} input=${message.usage.input_tokens} output=${message.usage.output_tokens}`,
    );

    return {
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      result: parsed,
    };
  }
}
