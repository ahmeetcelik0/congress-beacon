-- AlterTable
ALTER TABLE `Presentation` ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `titleEn` TEXT NULL;

-- AlterTable
ALTER TABLE `ProgramImportPresentation` ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `titleEn` TEXT NULL;

-- AlterTable
ALTER TABLE `ProgramImportSession` ADD COLUMN `series` TEXT NULL,
    ADD COLUMN `titleEn` TEXT NULL;

-- AlterTable
ALTER TABLE `Session` ADD COLUMN `series` TEXT NULL,
    ADD COLUMN `titleEn` TEXT NULL;
