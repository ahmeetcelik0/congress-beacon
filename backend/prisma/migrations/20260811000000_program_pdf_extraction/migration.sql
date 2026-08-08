-- Faz 4b: PDF/Excel'den bilimsel program cikarimi icin STAGING tablolari.
-- Onaylanmadan hicbir satir canli Session/Presentation/ProgramRole
-- tablolarina yazilmaz (bkz. docs/decisions.md).

-- Bir dosya yuklemesi/cikarim isi: durum makinesi + maliyet/kullanim kaydi.
CREATE TABLE `ProgramImport` (
    `id` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('PDF', 'EXCEL') NOT NULL,
    `status` ENUM('PENDING', 'EXTRACTING', 'DRAFT', 'APPROVED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `model` VARCHAR(191) NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `estimatedCostUsd` DOUBLE NULL,
    `pageCount` INTEGER NULL,
    `errorMessage` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProgramImport_congressId_status_idx`(`congressId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- LLM'in cikardigi oturum satirlari - Faz 2'nin ImportRowStatus enum'u
-- yeniden kullanilir (NEW/INVALID/EXCLUDED).
CREATE TABLE `ProgramImportSession` (
    `id` VARCHAR(191) NOT NULL,
    `importId` VARCHAR(191) NOT NULL,
    `rowOrder` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `rawHallName` VARCHAR(191) NULL,
    `hallId` VARCHAR(191) NULL,
    `dayLabel` VARCHAR(191) NULL,
    `rawDate` VARCHAR(191) NULL,
    `rawStartTime` VARCHAR(191) NULL,
    `rawEndTime` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `sessionType` VARCHAR(191) NULL,
    `keywords` VARCHAR(191) NULL,
    `status` ENUM('NEW', 'MATCHED', 'DUPLICATE', 'INVALID', 'EXCLUDED') NOT NULL,
    `message` VARCHAR(191) NULL,
    `warning` VARCHAR(191) NULL,

    INDEX `ProgramImportSession_importId_rowOrder_idx`(`importId`, `rowOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Bir oturum satirina bagli sunumlar.
CREATE TABLE `ProgramImportPresentation` (
    `id` VARCHAR(191) NOT NULL,
    `importSessionId` VARCHAR(191) NOT NULL,
    `rowOrder` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `rawStartTime` VARCHAR(191) NULL,
    `rawEndTime` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `abstract` TEXT NULL,
    `warning` VARCHAR(191) NULL,

    INDEX `ProgramImportPresentation_importSessionId_rowOrder_idx`(`importSessionId`, `rowOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Faz 4a'daki ProgramRole ile ayni "ya oturuma ya sunuma, ikisi birden
-- degil" kurali servis katmaninda dogrulanir (bkz. Prisma CHECK kisiti
-- desteklemiyor notu, docs/decisions.md).
CREATE TABLE `ProgramImportRole` (
    `id` VARCHAR(191) NOT NULL,
    `importSessionId` VARCHAR(191) NULL,
    `importPresentationId` VARCHAR(191) NULL,
    `type` ENUM('MODERATOR', 'SPEAKER', 'DISCUSSANT') NOT NULL,
    `rawName` VARCHAR(191) NOT NULL,
    `searchName` VARCHAR(191) NOT NULL,
    `previewMatchStatus` ENUM('MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'MANUAL', 'IGNORED') NOT NULL,
    `previewUserId` VARCHAR(191) NULL,

    INDEX `ProgramImportRole_importSessionId_idx`(`importSessionId`),
    INDEX `ProgramImportRole_importPresentationId_idx`(`importPresentationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProgramImport` ADD CONSTRAINT `ProgramImport_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramImport` ADD CONSTRAINT `ProgramImport_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramImportSession` ADD CONSTRAINT `ProgramImportSession_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `ProgramImport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramImportPresentation` ADD CONSTRAINT `ProgramImportPresentation_importSessionId_fkey` FOREIGN KEY (`importSessionId`) REFERENCES `ProgramImportSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramImportRole` ADD CONSTRAINT `ProgramImportRole_importSessionId_fkey` FOREIGN KEY (`importSessionId`) REFERENCES `ProgramImportSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramImportRole` ADD CONSTRAINT `ProgramImportRole_importPresentationId_fkey` FOREIGN KEY (`importPresentationId`) REFERENCES `ProgramImportPresentation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
