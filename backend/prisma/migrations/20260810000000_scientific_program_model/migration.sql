-- Faz 4a: Bilimsel Program Veri Modeli ve Konusmaci Eslestirme
--
-- Saf EKLEME migrasyonu - hicbir kolon/tablo dusurulmuyor, hicbir veri kaybi
-- riski yok. `Session.speaker` DEPRECATED olarak isaretlendi ama SILINMEDI
-- (mevcut veri + eski panel gorunumu icin). Iki seviyeli program modeli
-- (Session -> Presentation -> ProgramRole) ve isim-tabanli katilimci
-- eslestirmesi icin `User.searchName` eklenir.

-- 1) Session'a Faz 4a alanlari (hepsi nullable/varsayilanli)
ALTER TABLE `Session` ADD COLUMN `dayLabel` VARCHAR(191) NULL,
    ADD COLUMN `displayOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `keywords` VARCHAR(191) NULL,
    ADD COLUMN `sessionType` VARCHAR(191) NULL;

-- 2) User.searchName - normalizeTurkishName(firstName + ' ' + lastName).
-- Mevcut kullanicilar icin bu migration'dan SONRA calistirilacak geriye
-- donuk doldurma betiginde hesaplanir (bkz. scripts/backfill-search-name.ts,
-- DEPLOY-REHBERI.md).
ALTER TABLE `User` ADD COLUMN `searchName` VARCHAR(191) NULL;

-- 3) Presentation - bir Session'in altindaki tekil sunumlar
CREATE TABLE `Presentation` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `abstract` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Presentation_sessionId_displayOrder_idx`(`sessionId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4) ProgramRole - moderator/konusmaci/tartismaci; ya Session'a ya
-- Presentation'a baglidir (ikisi birden dolu/bos olamaz - servis katmaninda
-- dogrulanir, bkz. docs/decisions.md).
CREATE TABLE `ProgramRole` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `presentationId` VARCHAR(191) NULL,
    `type` ENUM('MODERATOR', 'SPEAKER', 'DISCUSSANT') NOT NULL,
    `rawName` VARCHAR(191) NOT NULL,
    `searchName` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `matchStatus` ENUM('MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'MANUAL', 'IGNORED') NOT NULL DEFAULT 'UNMATCHED',
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProgramRole_sessionId_idx`(`sessionId`),
    INDEX `ProgramRole_presentationId_idx`(`presentationId`),
    INDEX `ProgramRole_searchName_idx`(`searchName`),
    INDEX `ProgramRole_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5) Index'ler
CREATE INDEX `User_searchName_idx` ON `User`(`searchName`);

-- 6) FK'ler
-- Presentation/ProgramRole -> Session ve ProgramRole -> Presentation CASCADE:
-- bir oturum/sunum silinince altindaki sunumlar/roller de silinir (Bolum 6,
-- adim 8'de canli test edildi).
ALTER TABLE `Presentation` ADD CONSTRAINT `Presentation_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProgramRole` ADD CONSTRAINT `ProgramRole_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProgramRole` ADD CONSTRAINT `ProgramRole_presentationId_fkey` FOREIGN KEY (`presentationId`) REFERENCES `Presentation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ProgramRole -> User SET NULL: katilimcilar hic hard-delete edilmiyor
-- (bkz. Faz 2 karari "neden silme yerine pasiflestirme"), ama semanin
-- kendisi yine de bu durumda rolun SILINMEMESINI, yalnizca eslesmesinin
-- kaybolmasini (UNMATCHED'e degil, orphan userId=null'a) ongorur.
ALTER TABLE `ProgramRole` ADD CONSTRAINT `ProgramRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
