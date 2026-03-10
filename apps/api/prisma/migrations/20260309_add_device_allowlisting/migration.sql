-- AlterTable
ALTER TABLE "EnvironmentShare" ADD COLUMN IF NOT EXISTS "requireDeviceApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EnvironmentShareAllowedDevice" (
    "id" TEXT NOT NULL,
    "envShareId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT NOT NULL,

    CONSTRAINT "EnvironmentShareAllowedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EnvironmentSharePendingJoin" (
    "id" TEXT NOT NULL,
    "envShareId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentLabel" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentSharePendingJoin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EnvironmentShareAllowedDevice_envShareId_agentId_key" ON "EnvironmentShareAllowedDevice"("envShareId", "agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EnvironmentShareAllowedDevice_envShareId_idx" ON "EnvironmentShareAllowedDevice"("envShareId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EnvironmentSharePendingJoin_envShareId_agentId_key" ON "EnvironmentSharePendingJoin"("envShareId", "agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EnvironmentSharePendingJoin_envShareId_idx" ON "EnvironmentSharePendingJoin"("envShareId");

-- AddForeignKey
ALTER TABLE "EnvironmentShareAllowedDevice" ADD CONSTRAINT "EnvironmentShareAllowedDevice_envShareId_fkey" FOREIGN KEY ("envShareId") REFERENCES "EnvironmentShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnvironmentSharePendingJoin" ADD CONSTRAINT "EnvironmentSharePendingJoin_envShareId_fkey" FOREIGN KEY ("envShareId") REFERENCES "EnvironmentShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;
