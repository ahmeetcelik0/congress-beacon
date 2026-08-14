-- AlterTable
ALTER TABLE `ProgramImport` MODIFY `sourceType` ENUM('PDF', 'EXCEL', 'JSON') NOT NULL;

-- AlterTable
ALTER TABLE `ProgramImportSession` ADD COLUMN `hallAutoCreateExcluded` BOOLEAN NOT NULL DEFAULT false;
