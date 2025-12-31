-- Add security fields to Agent table
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "lastSeenIp" TEXT;

-- Create index for token expiry cleanup
CREATE INDEX IF NOT EXISTS "Agent_tokenExpiresAt_idx" ON "Agent"("tokenExpiresAt");

-- Create AgentTokenAuditLog table for security monitoring
CREATE TABLE IF NOT EXISTS "AgentTokenAuditLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "ipAddress" TEXT,
    "previousIp" TEXT,
    "userAgent" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTokenAuditLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for audit log queries
CREATE INDEX IF NOT EXISTS "AgentTokenAuditLog_agentId_createdAt_idx" ON "AgentTokenAuditLog"("agentId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AgentTokenAuditLog_event_idx" ON "AgentTokenAuditLog"("event");

-- Add foreign key constraint
ALTER TABLE "AgentTokenAuditLog" ADD CONSTRAINT "AgentTokenAuditLog_agentId_fkey" 
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

