import * as XLSX from 'xlsx';
import type Anthropic from '@anthropic-ai/sdk';
import { ProgramSourceType } from '../../../generated/prisma/client';

type ContentBlock = Anthropic.ContentBlockParam;

function preparePdfContent(buffer: Buffer): ContentBlock[] {
  return [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: buffer.toString('base64'),
      },
    },
  ];
}

// Excel dosyasi dogrudan belge olarak gonderilemez (Anthropic'in `document`
// blogu yalnizca PDF/metin kabul eder) - her sayfa duz metne cevrilir:
// sayfa adi baslik olarak, hucreler sekmeyle ayrilmis satirlar (bkz. Faz 4b
// talimati). `sheet_to_csv` FS:'\t' ile bunu tek satirda saglar.
function prepareExcelContent(buffer: Buffer): ContentBlock[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
    return `## Sayfa: ${sheetName}\n${csv}`;
  });
  return [{ type: 'text', text: parts.join('\n\n') }];
}

export function prepareDocumentContent(
  sourceType: ProgramSourceType,
  buffer: Buffer,
): ContentBlock[] {
  return sourceType === ProgramSourceType.PDF
    ? preparePdfContent(buffer)
    : prepareExcelContent(buffer);
}

// Tam PDF ayrıştırma (yeni bir bağımlılık) eklemeden, sayfa sayısını
// yalnızca BİLGİLENDİRME amaçli (maliyet tahmini ekraninda gosterilir,
// hicbir karar buna dayanmaz) kaba bir yontemle sayar: PDF nesne
// sozlugunde her sayfa `/Type /Page` (ebeveyni `/Pages` degil) ile
// isaretlenir. Nesne akislari (object streams) sikistirilmissa bu sayim
// bulamayip null donebilir - bu durumda panelde sayfa sayisi gosterilmez,
// baska hicbir sey bozulmaz.
export function countPdfPagesBestEffort(buffer: Buffer): number | null {
  const text = buffer.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches && matches.length > 0 ? matches.length : null;
}
