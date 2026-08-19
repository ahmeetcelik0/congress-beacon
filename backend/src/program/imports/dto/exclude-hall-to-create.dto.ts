import { IsString, MinLength } from 'class-validator';

// `hallName` onizlemede gosterilen ADAY isimdir (`hallsToCreate` listesinden
// birebir alinir) - `normalizeHallName` ile karsilastirilarak o adaya
// birlesen TUM satirlar tek seferde isaretlenir (bkz. Faz 4c talimati §3).
export class ExcludeHallToCreateDto {
  @IsString()
  @MinLength(1)
  hallName: string;
}
