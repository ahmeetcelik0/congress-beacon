-- CreateTable
CREATE TABLE `ObservationBatch` (
    `id` VARCHAR(191) NOT NULL,
    `clientBatchId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedCount` INTEGER NOT NULL,
    `duplicateCount` INTEGER NOT NULL,
    `rejectedCount` INTEGER NOT NULL,

    INDEX `ObservationBatch_deviceId_idx`(`deviceId`),
    INDEX `ObservationBatch_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BeaconObservation` (
    `id` VARCHAR(191) NOT NULL,
    `observationId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `congressId` VARCHAR(191) NOT NULL,
    `observedAt` DATETIME(3) NOT NULL,
    `serverReceivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `beaconId` VARCHAR(191) NULL,
    `uuid` VARCHAR(191) NOT NULL,
    `major` INTEGER NOT NULL,
    `minor` INTEGER NOT NULL,
    `rssi` INTEGER NOT NULL,
    `txPower` INTEGER NULL,
    `appVersion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BeaconObservation_userId_observedAt_idx`(`userId`, `observedAt`),
    INDEX `BeaconObservation_beaconId_idx`(`beaconId`),
    UNIQUE INDEX `BeaconObservation_observationId_uuid_major_minor_key`(`observationId`, `uuid`, `major`, `minor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceEvent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `hallId` VARCHAR(191) NOT NULL,
    `type` ENUM('ENTRY', 'EXIT') NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `confidenceScore` DOUBLE NULL,
    `algorithmVersion` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttendanceEvent_userId_occurredAt_idx`(`userId`, `occurredAt`),
    INDEX `AttendanceEvent_hallId_idx`(`hallId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HallVisit` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `hallId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `lastConfirmedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `isOpen` BOOLEAN NOT NULL DEFAULT true,
    `confidenceLevel` VARCHAR(191) NULL,
    `algorithmVersion` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HallVisit_userId_startedAt_idx`(`userId`, `startedAt`),
    INDEX `HallVisit_hallId_idx`(`hallId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPresenceState` (
    `userId` VARCHAR(191) NOT NULL,
    `candidateHallId` VARCHAR(191) NULL,
    `candidateStreak` INTEGER NOT NULL DEFAULT 0,
    `nonQualifyingStreak` INTEGER NOT NULL DEFAULT 0,
    `openHallVisitId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserPresenceState_openHallVisitId_key`(`openHallVisitId`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ObservationBatch` ADD CONSTRAINT `ObservationBatch_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ObservationBatch` ADD CONSTRAINT `ObservationBatch_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeaconObservation` ADD CONSTRAINT `BeaconObservation_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ObservationBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeaconObservation` ADD CONSTRAINT `BeaconObservation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeaconObservation` ADD CONSTRAINT `BeaconObservation_beaconId_fkey` FOREIGN KEY (`beaconId`) REFERENCES `Beacon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEvent` ADD CONSTRAINT `AttendanceEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEvent` ADD CONSTRAINT `AttendanceEvent_hallId_fkey` FOREIGN KEY (`hallId`) REFERENCES `Hall`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HallVisit` ADD CONSTRAINT `HallVisit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HallVisit` ADD CONSTRAINT `HallVisit_hallId_fkey` FOREIGN KEY (`hallId`) REFERENCES `Hall`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPresenceState` ADD CONSTRAINT `UserPresenceState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPresenceState` ADD CONSTRAINT `UserPresenceState_openHallVisitId_fkey` FOREIGN KEY (`openHallVisitId`) REFERENCES `HallVisit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
