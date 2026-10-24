import type ExcelJS from 'exceljs';

export type ColumnSpec = {
  header: string;
  key: string;
  width: number;
};

// Faz 13a: TÜM veri sayfalarının paylaştığı kurulum - donmuş başlık
// satırı (kaydırırken sütun adları kaybolmasın), otomatik filtre
// (Excel'in kendi filtre/sıralama arayüzü), kalın başlık yazı tipi.
// Her sayfa kendi sütunlarını tanımlar, bu fonksiyon SADECE ORTAK
// görsel/işlevsel iskeleti kurar - tek bir yerde tutulmazsa 5 sayfa 5
// farklı (ve muhtemelen tutarsız) kurulum kodu taşırdı.
//
// Sayfayı BU fonksiyon oluşturur (`workbook.addWorksheet` çağırıcıda
// AYRICA yapılmaz) - akış modunda `WorksheetWriter.views` yalnızca
// `addWorksheet`'in `options.views`'ı ÜZERİNDEN verilebilir, sayfa
// oluşturulduktan SONRA atanamaz (yalnızca getter'dır - gerçek bir
// istekle denenip `TypeError: Cannot set property views of
// #<WorksheetWriter> which has only a getter` ile keşfedildi).
export function setupDataWorksheet(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  name: string,
  columns: ColumnSpec[],
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  worksheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.commit();
  return worksheet;
}

// Türkiye saatinde tarih+saat gösterimi - GERÇEK Excel tarih hücresi
// (bkz. `congress-time.ts` `toIstanbulWallClockDate` - bu yardımcı SADECE
// biçimi standartlaştırır, dönüşümü YAPMAZ, çağıran taraf hücreye zaten
// `toIstanbulWallClockDate` ile üretilmiş bir `Date` vermelidir).
export const DATETIME_FORMAT = 'dd.mm.yyyy hh:mm:ss';

// Boş sayfa davranışı: veri yoksa sayfa YİNE OLUŞUR, "Bu aralıkta kayıt
// yok" yazar. Sayfayı hiç oluşturmamak "sayfa nerede?" sorusuna yol açar
// (bkz. docs/decisions.md "Faz 13a" - bu proje sessiz eksikliği KASITLI
// olarak reddediyor, bkz. Faz 12'deki saat kayması hatası).
export function writeEmptyNotice(
  worksheet: ExcelJS.Worksheet,
  message: string,
): void {
  const row = worksheet.addRow([message]);
  row.font = { italic: true };
  row.commit();
}
