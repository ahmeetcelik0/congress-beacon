import { Transform } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

// Faz 13a: tarih+saat aralığı ZORUNLUDUR - "tüm kongre" seçeneği YOKTUR.
// Gerçek bir kongrede (200 kişi, 2 gün, 10+ beacon) ham gözlem sayısı
// ~15 milyon satıra çıkar (bkz. docs/decisions.md "Faz 13a" ölçüm: tek
// kullanıcı, 34 saatte 133.191 gözlem, yalnızca 3 beacon ile) - filtresiz
// bir istek Excel'in sayfa başına satır limitini (1.048.576) kesin aşar.
//
// `userIds`/`hallIds` virgülle ayrılmış TEK bir query parametresi olarak
// gelir (`?userIds=id1,id2`) - panelin indirme linki `<a href>` ile
// doğrudan URL oluşturduğu için (CSV indirme deseniyle aynı, bkz.
// `reports-download-link.tsx`), `URLSearchParams` array desteğine
// gerek kalmadan basit string birleştirmeyle üretilebiliyor.
function parseIdList(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export class AnalizDefteriQueryDto {
  @IsUUID()
  congressId: string;

  // `from`/`to` panelden zaten GERÇEK UTC ISO metni olarak gelir
  // (`web/src/lib/congress-time.ts` `datetimeLocalToIso` - bkz. Faz 12).
  // Burada YENİ bir saat dönüşümü YAPILMAZ, yalnızca biçim doğrulanır.
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsArray()
  @IsUUID('4', { each: true })
  hallIds?: string[];

  // İndirme linki doğrudan tarayıcı navigasyonuyla tetiklendiği (fetch
  // değil) için Authorization header'ı eklenemiyor, `AdminJwtGuard` bu
  // tek durum için token'ı query string'den de okuyor (bkz. o dosyadaki
  // yorum). Guard `request.query.token`'ı DOĞRUDAN okur, bu alan DTO
  // içinde HİÇ KULLANILMAZ - sadece global `forbidNonWhitelisted`
  // ValidationPipe'ın (bkz. `main.ts`) "property token should not exist"
  // ile isteği reddetmesini önlemek için burada.
  @IsOptional()
  @IsString()
  token?: string;
}
