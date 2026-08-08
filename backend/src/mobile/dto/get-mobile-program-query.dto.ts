import { IsOptional, IsString, IsUUID } from 'class-validator';

// congressId BURADA YOK - kongre kimligi istemciden ALINMAZ, token'daki
// activeCongressId'den gelir (bkz. Faz 5 talimati "kullanici baska bir
// kongrenin verisini isteyememeli").
export class GetMobileProgramQueryDto {
  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsUUID()
  hallId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
