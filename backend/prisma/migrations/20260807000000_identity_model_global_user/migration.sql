-- Faz 1: Kimlik Modeli Yeniden Yapilandirmasi
--
-- User artik tek bir kongreye kilitli degil (congressId kaldiriliyor);
-- kullanici <-> kongre iliskisi yeni CongressRegistration tablosu uzerinden
-- coktan-coka kuruluyor. Adim sirasi KRITIK - veri kaybi olmadan gecis icin:
--   1) CongressRegistration tablosunu olustur.
--   2) Mevcut her User icin (eski congressId'sinden) bir CongressRegistration
--      satiri uret (source='PILOT') - bu adim atlanirsa mevcut tum
--      katilimcilar kongresiz kalir.
--   3) User'a yeni kimlik alanlarini ekle, phoneLast4'u nullable yap.
--   4) Eski (congressId, firstName, lastName, phoneLast4) unique index'ini dusur.
--   5) EN SON: User.congressId kolonunu (ve FK'sini) dusur.

-- 1) CongressRegistration tablosu
CREATE TABLE `CongressRegistration` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `source` ENUM('API', 'IMPORT', 'MANUAL', 'PILOT') NOT NULL DEFAULT 'MANUAL',
    `externalId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CongressRegistration_congressId_idx`(`congressId`),
    INDEX `CongressRegistration_userId_idx`(`userId`),
    UNIQUE INDEX `CongressRegistration_congressId_userId_key`(`congressId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Mevcut her User icin eski congressId'den bir CongressRegistration uret.
--    registeredAt = User.createdAt (kullanicinin sistemde ilk gorundugu an) -
--    bu, bu migration'in calisma anindan degil, gercek kayit anindan
--    itibaren dogru bir tarih tasimasini saglar. BU ADIM ATLANIRSA mevcut
--    tum katilimcilar kongresiz kalir.
INSERT INTO `CongressRegistration`
    (`id`, `userId`, `congressId`, `source`, `externalId`, `isActive`, `registeredAt`, `createdAt`, `updatedAt`)
SELECT
    UUID(), `id`, `congressId`, 'PILOT', NULL, true, `createdAt`, NOW(3), NOW(3)
FROM `User`;

-- 3) User'a yeni kimlik alanlarini ekle, phoneLast4'u nullable yap.
ALTER TABLE `User`
    MODIFY `phoneLast4` VARCHAR(191) NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `passwordHash` VARCHAR(191) NULL,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

ALTER TABLE `User` ADD UNIQUE INDEX `User_email_key`(`email`);
ALTER TABLE `User` ADD UNIQUE INDEX `User_phone_key`(`phone`);

-- 4) Once FK'yi dusur - MySQL, ayni kolonu (congressId) kapsayan bir unique
--    index FK tarafindan destekleniyorsa index'in dusurulmesine izin vermiyor
--    (hata 1553). FK -> index -> kolon sirasi zorunlu.
ALTER TABLE `User` DROP FOREIGN KEY `User_congressId_fkey`;

-- 5) Eski (congressId, firstName, lastName, phoneLast4) unique index'ini dusur.
ALTER TABLE `User` DROP INDEX `User_congressId_firstName_lastName_phoneLast4_key`;

-- 6) EN SON: User.congressId kolonunu dusur (artik iliski
--    CongressRegistration uzerinden kuruluyor).
ALTER TABLE `User` DROP COLUMN `congressId`;

-- CongressRegistration <-> User / Congress FK'leri
ALTER TABLE `CongressRegistration` ADD CONSTRAINT `CongressRegistration_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CongressRegistration` ADD CONSTRAINT `CongressRegistration_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
