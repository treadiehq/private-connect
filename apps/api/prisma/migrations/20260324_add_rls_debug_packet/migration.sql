-- Add Row Level Security to DebugPacket and DebugAIMessage tables.
-- These tables lack a direct workspaceId column; RLS is NOT inherited
-- through foreign keys in PostgreSQL, so explicit policies are required.
-- Policies join through DebugSession to verify workspace ownership.

-- ============================================================================
-- DebugPacket
-- ============================================================================

ALTER TABLE "DebugPacket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebugPacket" FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_select ON "DebugPacket"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_insert ON "DebugPacket"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_update ON "DebugPacket"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_delete ON "DebugPacket"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

-- ============================================================================
-- DebugAIMessage
-- ============================================================================

ALTER TABLE "DebugAIMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebugAIMessage" FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_select ON "DebugAIMessage"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_insert ON "DebugAIMessage"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_update ON "DebugAIMessage"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_delete ON "DebugAIMessage"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "sessionId" IN (
            SELECT id FROM "DebugSession"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );
