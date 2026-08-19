-- Faz 4b canli testinde gercek bir kongre programinda (33. Ulusal Uygulamali
-- Girisimsel Kardiyoloji Kongresi) VARCHAR(191)'i asan iki dilli (TR/EN tek
-- satirda birlesik) oturum basliklariyla karsilasildi - bkz. docs/decisions.md.
-- Hem canli Session/Presentation hem de staging ProgramImportSession/
-- ProgramImportPresentation'daki `title` alanlari TEXT'e genisletildi.

-- AlterTable
ALTER TABLE `Presentation` MODIFY `title` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `ProgramImportPresentation` MODIFY `title` TEXT NULL;

-- AlterTable
ALTER TABLE `ProgramImportSession` MODIFY `title` TEXT NULL;

-- AlterTable
ALTER TABLE `Session` MODIFY `title` TEXT NOT NULL;
