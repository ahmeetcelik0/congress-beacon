import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export const MAX_IMPORT_ROWS = 10_000;

export type RegistrationFileContent = {
  headerRow: string[];
  dataRows: string[][];
};

// xlsx (ZIP) 'PK' imzasiyla, xls (OLE2/CFB) 0xD0CF11E0 imzasiyla baslar -
// ikisi de HAM BINARY olarak okunmali. CSV duz metin oldugu icin bu
// imzalarin hicbiriyle eslesmez.
function isBinarySpreadsheet(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle =
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;
  return isZip || isOle;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// .xlsx/.xls binary formatlar buffer olarak, .csv ise ONCE UTF-8 STRING'E
// CEVRILEREK okunur. SheetJS'e CSV icerigi dogrudan buffer olarak
// verildiginde Turkce karakterleri (Ş, İ, ...) yanlis kod sayfasiyla
// (Latin-1/CP1252) coz,up bozuyor ("Şehir" -> "Åehir") - bu, dernekten
// gelen gercek verilerde (Turkce ad/soyad, sehir vb.) sessizce veri
// bozulmasi anlamina gelir, bu yuzden buffer/string ayrimi BILINCLI.
export function readRegistrationFile(buffer: Buffer): RegistrationFileContent {
  let workbook: XLSX.WorkBook;
  try {
    workbook = isBinarySpreadsheet(buffer)
      ? XLSX.read(buffer, { type: 'buffer' })
      : XLSX.read(stripBom(buffer.toString('utf8')), { type: 'string' });
  } catch {
    throw new BadRequestException(
      'Dosya okunamadı. Desteklenen formatlar: .xlsx, .xls, .csv',
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestException('Dosyada hiç sayfa bulunamadı');
  }
  const sheet = workbook.Sheets[sheetName];

  // header:1 -> satirlar dizi-icinde-dizi olarak gelir (baslik satirini
  // kendimiz ayirmak icin), defval:'' -> bos hucreler undefined degil ''
  // olsun, blankrows:false -> tamamen bos satirlar atlanir.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });

  if (rows.length === 0) {
    throw new BadRequestException('Dosya boş görünüyor');
  }

  const [headerRow, ...dataRows] = rows;

  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestException(
      `Dosya en fazla ${MAX_IMPORT_ROWS} satır olabilir (bu dosyada ${dataRows.length} satır var)`,
    );
  }

  return {
    headerRow: headerRow.map(toCellString),
    dataRows: dataRows.map((row) => row.map(toCellString)),
  };
}

// raw:false sayesinde SheetJS hucreleri zaten goruntu string'i olarak
// doner, ama tip seviyesinde `unknown` - String(deger) yerine daraltarak
// donusturur ki bir obje sizarsa sessizce "[object Object]" yazilmasin.
function toCellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}
