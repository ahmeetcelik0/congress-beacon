-- Faz 2: Katilimci ve Kayit Yonetimi
--
-- Saf EKLEME migrasyonu - hicbir kolon/tablo dusurulmuyor, hicbir veri
-- kaybi riski yok. User.phoneRaw eklenir (ham telefon, normalize
-- edilemeyen numaralar icin veri kaybini onleyen alan); Excel/CSV import
-- akisinin staging modeli (RegistrationImport + RegistrationImportRow)
-- olusturulur.

-- 1) User.phoneRaw
ALTER TABLE `User` ADD COLUMN `phoneRaw` VARCHAR(191) NULL;

-- 2) RegistrationImport
CREATE TABLE `RegistrationImport` (
    `id` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `totalRows` INTEGER NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RegistrationImport_congressId_status_idx`(`congressId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) RegistrationImportRow
CREATE TABLE `RegistrationImportRow` (
    `id` VARCHAR(191) NOT NULL,
    `importId` VARCHAR(191) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `rawFirstName` VARCHAR(191) NULL,
    `rawLastName` VARCHAR(191) NULL,
    `rawEmail` VARCHAR(191) NULL,
    `rawPhone` VARCHAR(191) NULL,
    `normalizedEmail` VARCHAR(191) NULL,
    `normalizedPhone` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `status` ENUM('NEW', 'MATCHED', 'DUPLICATE', 'INVALID', 'EXCLUDED') NOT NULL,
    `message` VARCHAR(191) NULL,
    `warning` VARCHAR(191) NULL,
    `matchedUserId` VARCHAR(191) NULL,

    INDEX `RegistrationImportRow_importId_status_idx`(`importId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FK'ler
ALTER TABLE `RegistrationImport` ADD CONSTRAINT `RegistrationImport_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RegistrationImport` ADD CONSTRAINT `RegistrationImport_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RegistrationImportRow` ADD CONSTRAINT `RegistrationImportRow_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `RegistrationImport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
