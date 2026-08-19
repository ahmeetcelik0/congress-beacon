import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

// Sirlamayi tek tek PATCH ile yapmak yaris durumuna (iki yetkili ayni anda
// farkli sirlar gonderirse) yol acar - bu yuzden tum sira TEK istekte,
// istenen nihai sirada gelir. Sunucu ids[i]'nin displayOrder'ini i yapar.
export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];
}
