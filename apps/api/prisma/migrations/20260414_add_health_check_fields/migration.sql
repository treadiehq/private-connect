-- AlterTable
ALTER TABLE "Service" ADD COLUMN "healthCheckEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Service" ADD COLUMN "healthCheckInterval" INTEGER NOT NULL DEFAULT 60;
