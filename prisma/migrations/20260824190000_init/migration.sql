CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Session` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
  INDEX `Session_userId_idx`(`userId`),
  INDEX `Session_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserSettings` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `language` ENUM('HR','EN','DE') NOT NULL DEFAULT 'HR',
  `theme` ENUM('SYSTEM','LIGHT','DARK') NOT NULL DEFAULT 'SYSTEM',
  `timezone` VARCHAR(80) NOT NULL DEFAULT 'Europe/Zagreb',
  `weekStartsMonday` BOOLEAN NOT NULL DEFAULT true,
  `focusMinutes` INTEGER NOT NULL DEFAULT 25,
  `breakMinutes` INTEGER NOT NULL DEFAULT 5,
  `quietStart` VARCHAR(5) NULL,
  `quietEnd` VARCHAR(5) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `UserSettings_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlannerItem` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` ENUM('TASK','EVENT','NOTE') NOT NULL DEFAULT 'TASK',
  `title` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `startAt` DATETIME(3) NULL,
  `endAt` DATETIME(3) NULL,
  `dueAt` DATETIME(3) NULL,
  `allDay` BOOLEAN NOT NULL DEFAULT false,
  `completedAt` DATETIME(3) NULL,
  `priority` ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
  `category` VARCHAR(60) NULL,
  `color` VARCHAR(20) NULL,
  `isInbox` BOOLEAN NOT NULL DEFAULT false,
  `repeatType` ENUM('NONE','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'NONE',
  `repeatInterval` INTEGER NOT NULL DEFAULT 1,
  `repeatUntil` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PlannerItem_userId_startAt_idx`(`userId`, `startAt`),
  INDEX `PlannerItem_userId_dueAt_idx`(`userId`, `dueAt`),
  INDEX `PlannerItem_userId_isInbox_idx`(`userId`, `isInbox`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ItemOccurrenceState` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `occurrenceAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `skippedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ItemOccurrenceState_itemId_occurrenceAt_key`(`itemId`, `occurrenceAt`),
  INDEX `ItemOccurrenceState_occurrenceAt_idx`(`occurrenceAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Reminder` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `offsetMinutes` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Reminder_userId_idx`(`userId`),
  INDEX `Reminder_itemId_idx`(`itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReminderDelivery` (
  `id` VARCHAR(191) NOT NULL,
  `reminderId` VARCHAR(191) NOT NULL,
  `occurrenceAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ReminderDelivery_reminderId_occurrenceAt_key`(`reminderId`, `occurrenceAt`),
  INDEX `ReminderDelivery_sentAt_idx`(`sentAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Habit` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `emoji` VARCHAR(12) NOT NULL DEFAULT '✓',
  `color` VARCHAR(20) NOT NULL DEFAULT '#7c5cff',
  `targetPerWeek` INTEGER NOT NULL DEFAULT 7,
  `reminderTime` VARCHAR(5) NULL,
  `archived` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Habit_userId_archived_idx`(`userId`, `archived`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HabitCheckin` (
  `id` VARCHAR(191) NOT NULL,
  `habitId` VARCHAR(191) NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HabitCheckin_habitId_date_key`(`habitId`, `date`),
  INDEX `HabitCheckin_date_idx`(`date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


CREATE TABLE `HabitReminderDelivery` (
  `id` VARCHAR(191) NOT NULL,
  `habitId` VARCHAR(191) NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HabitReminderDelivery_habitId_date_key`(`habitId`, `date`),
  INDEX `HabitReminderDelivery_sentAt_idx`(`sentAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FocusSession` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `durationMin` INTEGER NOT NULL,
  `label` VARCHAR(120) NULL,
  `completed` BOOLEAN NOT NULL DEFAULT true,
  `startedAt` DATETIME(3) NOT NULL,
  `endedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `FocusSession_userId_startedAt_idx`(`userId`, `startedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Reflection` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `mood` INTEGER NULL,
  `energy` INTEGER NULL,
  `gratitude` TEXT NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Reflection_userId_date_key`(`userId`, `date`),
  INDEX `Reflection_date_idx`(`date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PushSubscription` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `endpoint` VARCHAR(768) NOT NULL,
  `p256dh` TEXT NOT NULL,
  `auth` TEXT NOT NULL,
  `userAgent` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PushSubscription_endpoint_key`(`endpoint`),
  INDEX `PushSubscription_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserSettings` ADD CONSTRAINT `UserSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlannerItem` ADD CONSTRAINT `PlannerItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ItemOccurrenceState` ADD CONSTRAINT `ItemOccurrenceState_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `PlannerItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Reminder` ADD CONSTRAINT `Reminder_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `PlannerItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Reminder` ADD CONSTRAINT `Reminder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReminderDelivery` ADD CONSTRAINT `ReminderDelivery_reminderId_fkey` FOREIGN KEY (`reminderId`) REFERENCES `Reminder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Habit` ADD CONSTRAINT `Habit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `HabitCheckin` ADD CONSTRAINT `HabitCheckin_habitId_fkey` FOREIGN KEY (`habitId`) REFERENCES `Habit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `HabitReminderDelivery` ADD CONSTRAINT `HabitReminderDelivery_habitId_fkey` FOREIGN KEY (`habitId`) REFERENCES `Habit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FocusSession` ADD CONSTRAINT `FocusSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Reflection` ADD CONSTRAINT `Reflection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
