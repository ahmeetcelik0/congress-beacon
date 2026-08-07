import * as XLSX from 'xlsx';

// Katilimci import sablonu: basliklar + biri yurt disi numarali iki ornek
// satir - yetkilinin yurt disi numaralarin da desteklendigini gormesi icin.
export function buildRegistrationTemplate(): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Ad', 'Soyad', 'E-posta', 'Telefon', 'Kayıt No'],
    ['Ayşe', 'Yılmaz', 'ayse.yilmaz@example.com', '0532 123 45 67', 'REG-1001'],
    ['John', 'Smith', 'john.smith@example.com', '+44 20 7946 0958', 'REG-1002'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Katılımcılar');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
