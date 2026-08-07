import { IsIn, IsOptional, IsUUID } from 'class-validator';

// purpose sadece bilgi/denetim amacli (audit log'da hangi amacla
// yuklendigi gorunsun diye) - dosyanin nereye kaydedilecegini ETKILEMEZ,
// hepsi ayni <congressId>/<uuid>.<ext> deseniyle kaydedilir.
const UPLOAD_PURPOSES = ['cover', 'venue', 'sponsor', 'speaker'] as const;

export class UploadFileDto {
  @IsUUID()
  congressId: string;

  @IsOptional()
  @IsIn(UPLOAD_PURPOSES)
  purpose?: (typeof UPLOAD_PURPOSES)[number];
}
