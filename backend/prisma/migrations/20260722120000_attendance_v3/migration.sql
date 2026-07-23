-- AlterTable
ALTER TABLE `AttendanceEvent` ADD COLUMN `decisionTrace` JSON NULL;

-- AlterTable
ALTER TABLE `Congress` ADD COLUMN `ambiguityMarginPct` DOUBLE NOT NULL DEFAULT 5,
    ADD COLUMN `confidenceTemperature` DOUBLE NOT NULL DEFAULT 8,
    ADD COLUMN `emaAlpha` DOUBLE NOT NULL DEFAULT 0.35,
    ADD COLUMN `entryProbabilityThreshold` DOUBLE NOT NULL DEFAULT 60,
    ADD COLUMN `exitProbabilityThreshold` DOUBLE NOT NULL DEFAULT 40,
    ADD COLUMN `hampelK` DOUBLE NOT NULL DEFAULT 3,
    ADD COLUMN `hampelWindowSize` INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE `UserPresenceState` ADD COLUMN `currentStatus` ENUM('IN_HALL', 'AMBIGUOUS', 'NO_SIGNAL') NOT NULL DEFAULT 'NO_SIGNAL';

