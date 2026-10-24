import ExcelJS from 'exceljs';
import type { Response } from 'express';

// Faz 13a: AKIŞ tabanlı defter yazıcısı - `ExcelJS.stream.xlsx.WorkbookWriter`
// satırları BELLEKTE BİRİKTİRMEDEN doğrudan HTTP yanıtına yazar. Mevcut
// `xlsx` (SheetJS) paketi bunu DESTEKLEMİYOR (tüm defteri bellekte kurup
// sonra tek seferde yazıyor) - 15 milyon satırlık bir kongrede bu yüzlerce
// megabayt demek (bkz. docs/decisions.md "Faz 13a"). `xlsx` paketi
// KALDIRILMADI, katılımcı şablonu üretiminde kullanılmaya devam ediyor -
// bu SADECE büyük/akış gerektiren dışa aktarımlar için ayrı bir araç.
//
// `useStyles: true` - kapak sayfasındaki başlık/uyarı vurguları ve
// başlık satırı kalınlığı için gerekli (performans maliyeti kabul
// edilebilir, tek kullanıcı - dahili ekip - için üretilen bir rapor).
export function createStreamingWorkbook(
  res: Response,
): ExcelJS.stream.xlsx.WorkbookWriter {
  return new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: false,
  });
}
