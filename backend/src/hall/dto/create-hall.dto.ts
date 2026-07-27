import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateHallDto {
  @IsUUID()
  congressId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(0)
  rssiThreshold?: number;

  // Salonun ayni anda kabul edebilecegi fiziksel kisi kapasitesi. Ust sinir
  // bilincli olarak yok - projede ortak bir "maksimum kapasite" kavrami yok.
  // Gonderilmezse (eski istemci uyumlulugu) null kalir - varsayilan deger
  // ATANMAZ, tahmini/sahte kapasite yazilmasi bilincli olarak engellenir.
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
