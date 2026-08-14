-- AlterTable
-- Once NULLABLE olarak eklenir - mevcut 5 satir icin backfill YAPILANA
-- kadar NOT NULL uygulanamaz (bkz. Faz 9, sessionId artik birlestirilmis
-- bildirimlerde NULL olabildigi icin congressId ayrica tutuluyor).
ALTER TABLE `NotificationLog` ADD COLUMN `congressId` VARCHAR(191) NULL;

-- Backfill: mevcut satirlarin tumunde sessionId doludur (bu sutun Faz 9'dan
-- ONCE eklendigi icin) - Session uzerinden congressId turetilir.
UPDATE `NotificationLog` nl
JOIN `Session` s ON s.id = nl.sessionId
SET nl.congressId = s.congressId
WHERE nl.sessionId IS NOT NULL;

-- AlterTable
ALTER TABLE `NotificationLog` MODIFY COLUMN `congressId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `NotificationLog_congressId_sentAt_idx` ON `NotificationLog`(`congressId`, `sentAt`);

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_congressId_fkey` FOREIGN KEY (`congressId`) REFERENCES `Congress`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
