-- CreateTable
CREATE TABLE "ResourceSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "resourceName" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "localPort" INTEGER NOT NULL,
    "targetHost" TEXT NOT NULL,
    "targetPort" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ResourceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceSession_workspaceId_idx" ON "ResourceSession"("workspaceId");
CREATE INDEX "ResourceSession_agentId_idx" ON "ResourceSession"("agentId");
CREATE INDEX "ResourceSession_status_idx" ON "ResourceSession"("status");

-- AddForeignKey
ALTER TABLE "ResourceSession" ADD CONSTRAINT "ResourceSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
ALTER TABLE "ResourceSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResourceSession" FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_select ON "ResourceSession"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "ResourceSession"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "ResourceSession"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "ResourceSession"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );
