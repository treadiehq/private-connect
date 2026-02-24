-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "clientType" TEXT;

-- AlterTable
ALTER TABLE "AgentTokenAuditLog" ADD COLUMN "clientType" TEXT;
