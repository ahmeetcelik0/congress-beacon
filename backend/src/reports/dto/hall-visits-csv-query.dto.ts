import { IsOptional, IsString } from 'class-validator';
import { HallVisitsQueryDto } from '../../attendance/dto/hall-visits-query.dto';

// AdminJwtGuard, <a href> indirme linkleri icin token'i query string'den de
// okuyabiliyor; bu alan yalnizca ValidationPipe'in forbidNonWhitelisted
// kuralinin bu query parametresini reddetmemesi icin var, DTO'nun kendisi
// tarafindan kullanilmiyor.
export class HallVisitsCsvQueryDto extends HallVisitsQueryDto {
  @IsOptional()
  @IsString()
  token?: string;
}
