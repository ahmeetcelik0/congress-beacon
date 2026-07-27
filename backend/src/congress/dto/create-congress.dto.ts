import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { IsGreaterThanField } from './is-greater-than-field.validator';
import { IsDateOnOrAfterField } from './is-date-on-or-after-field.validator';

export class CreateCongressDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  code: string;

  @IsString()
  @MinLength(4)
  accessCode: string;

  @IsUUID()
  beaconUuid: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  // Ikisi de gonderildiginde bitis, baslangictan ONCE olamaz (esitlik
  // serbest - tek gunluk kongreler icin). Yalnizca biri gonderilirse burada
  // karar verilemez, kismi PATCH'te CongressService.update() kayitli
  // degerle birlestirip nihai kontrolu bir kez daha yapar (bkz. dosya).
  @IsDateOnOrAfterField('startDate', {
    message: 'Bitis tarihi baslangic tarihinden once olamaz',
  })
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  observationIntervalSeconds?: number;

  // --- Salon tespit algoritmasi v3 ayarlari (saha kalibrasyonunda ayarlanir) ---

  // EMA yumusatma katsayisi: 1'e yaklastikca sistem yeni olcume daha hizli
  // tepki verir ama gurultuye de daha acik hale gelir.
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1)
  emaAlpha?: number;

  // Hampel filtresinin siddeti: kucukse daha cok okuma "anormal" sayilir.
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(10)
  hampelK?: number;

  // Outlier tespitinde bakilan son okuma sayisi. 3'un altinda medyan/MAD
  // anlamli calismaz.
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(20)
  hampelWindowSize?: number;

  // Softmax sicakligi: buyudukce salonlar arasi yuzdeler birbirine yaklasir.
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  confidenceTemperature?: number;

  // Cikis esiginden kesinlikle buyuk olmali - aksi halde histerezis coker.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsGreaterThanField('exitProbabilityThreshold', {
    message:
      'Giris esigi (entryProbabilityThreshold) cikis esiginden (exitProbabilityThreshold) buyuk olmalidir',
  })
  entryProbabilityThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  exitProbabilityThreshold?: number;

  // Iki salonun yuzde farki bunun altindaysa sistem taraf secmez (belirsiz).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  ambiguityMarginPct?: number;

  // Bir beacon'in son gecerli okumasindan sonra kac saniye daha "hala
  // guvenilir" sayilip son bilinen EMA'siyla salon ortalamasina dahil
  // edilmeye devam edecegi. Saha testinde bulunan gercek bir hatanin
  // duzeltmesi: tek beacon'li bir salonun 1-2 turluk gecici sinyal
  // kesintisi, salonu aninda aday disi birakip rakip salona "isinlanma"ya
  // (aninda EXIT+ENTRY) yol aciyordu. Bkz. docs/decisions.md.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  staleGraceSeconds?: number;
}
