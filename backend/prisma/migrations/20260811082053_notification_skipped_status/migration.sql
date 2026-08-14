-- AlterTable
ALTER TABLE `NotificationLog` MODIFY `status` ENUM('SENT', 'FAILED', 'SKIPPED') NOT NULL;
