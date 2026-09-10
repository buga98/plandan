ALTER TABLE `UserSettings`
  ADD COLUMN `holidayCountry` VARCHAR(8) NOT NULL DEFAULT 'HR',
  ADD COLUMN `showHolidays` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `Habit`
  ADD COLUMN `targetPerDay` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `reminderMode` ENUM('NONE','FIXED','INTERVAL') NOT NULL DEFAULT 'NONE',
  ADD COLUMN `reminderIntervalMinutes` INTEGER NULL,
  ADD COLUMN `reminderStartTime` VARCHAR(5) NULL,
  ADD COLUMN `reminderEndTime` VARCHAR(5) NULL;

UPDATE `Habit`
SET `reminderMode` = CASE WHEN `reminderTime` IS NULL THEN 'NONE' ELSE 'FIXED' END;

ALTER TABLE `HabitCheckin`
  ADD COLUMN `count` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `HabitReminderSlotDelivery` (
  `id` VARCHAR(191) NOT NULL,
  `habitId` VARCHAR(191) NOT NULL,
  `scheduledAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HabitReminderSlotDelivery_habitId_scheduledAt_key`(`habitId`, `scheduledAt`),
  INDEX `HabitReminderSlotDelivery_sentAt_idx`(`sentAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DayOff` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT '#ef5da8',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DayOff_userId_date_key`(`userId`, `date`),
  INDEX `DayOff_userId_date_idx`(`userId`, `date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HabitReminderSlotDelivery` ADD CONSTRAINT `HabitReminderSlotDelivery_habitId_fkey` FOREIGN KEY (`habitId`) REFERENCES `Habit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DayOff` ADD CONSTRAINT `DayOff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
