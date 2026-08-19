-- Faz 3: Kongre Icerik Yonetimi
--
-- Saf EKLEME migrasyonu - hicbir kolon/tablo dusurulmuyor, hicbir veri
-- kaybi riski yok. Congress'e mobil ana sayfa karti icin nullable alanlar
-- eklenir; Venue/Announcement/Sponsor/KeynoteSpeaker/CongressInfoSection
-- icerik tablolari olusturulur.

-- 1) Congress icerik alanlari
ALTER TABLE `Congress`
    ADD COLUMN `fullName` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `coverImageUrl` VARCHAR(191) NULL,
    ADD COLUMN `websiteUrl` VARCHAR(191) NULL,
    ADD COLUMN `contactEmail` VARCHAR(191) NULL,
    ADD COLUMN `contactPhone` VARCHAR(191) NULL;

-- 2) Venue
CREATE TABLE `Venue` (
    `id` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `type` ENUM('MAIN', 'HOTEL') NOT NULL DEFAULT 'HOTEL',
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `websiteUrl` VARCHAR(191) NULL,
    `mapUrl` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Venue_congressId_type_displayOrder_idx`(`congressId`, `type`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Announcement
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Announcement_congressId_publishedAt_idx`(`congressId`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4) Sponsor
CREATE TABLE `Sponsor` (
    `id` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tier` ENUM('PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'SUPPORTER') NOT NULL DEFAULT 'SUPPORTER',
    `logoUrl` VARCHAR(191) NULL,
    `websiteUrl` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sponsor_congressId_tier_displayOrder_idx`(`congressId`, `tier`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5) KeynoteSpeaker
CREATE TABLE `KeynoteSpeaker` (
    `id` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `institution` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `photoUrl` VARCHAR(191) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KeynoteSpeaker_congressId_displayOrder_idx`(`congressId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6) CongressInfoSection
CREATE TABLE `CongressInfoSection` (
    `id` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CongressInfoSection_congressId_displayOrder_idx`(`congressId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FK'ler
ALTER TABLE `Venue` ADD CONSTRAINT `Venue_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Sponsor` ADD CONSTRAINT `Sponsor_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KeynoteSpeaker` ADD CONSTRAINT `KeynoteSpeaker_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CongressInfoSection` ADD CONSTRAINT `CongressInfoSection_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
