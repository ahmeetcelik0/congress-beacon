import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

// Sirlamayi tek tek PATCH ile yapmak yaris durumuna yol acar - tum sira TEK
// istekte, istenen nihai sirada gelir. Sunucu ids[i]'nin displayOrder'ini i
// yapar (bkz. content/reorder.dto.ts - ayni desen, ayri modulde tekrari
// gereksiz soyutlamadan kacinmak icin bilincli).
export class ReorderSessionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];
}
