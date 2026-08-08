import { IsString, MinLength } from 'class-validator';

// rawName duzeltilince searchName + previewMatchStatus/previewUserId
// YENIDEN hesaplanir (mevcut matchRole() cagrilarak) - bkz.
// ProgramImportsService.updateRole.
export class UpdateProgramImportRoleDto {
  @IsString()
  @MinLength(2)
  rawName: string;
}
