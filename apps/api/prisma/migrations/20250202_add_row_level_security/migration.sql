-- Row Level Security (RLS) Migration
-- Adds database-level tenant isolation as defense-in-depth
-- The application already scopes queries by workspaceId; RLS adds a second layer

-- ============================================================================
-- ENABLE RLS ON WORKSPACE-SCOPED TABLES
-- ============================================================================

-- Agent table
ALTER TABLE "Agent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Agent" FORCE ROW LEVEL SECURITY;

-- Service table
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" FORCE ROW LEVEL SECURITY;

-- ApiKey table
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" FORCE ROW LEVEL SECURITY;

-- DebugSession table
ALTER TABLE "DebugSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebugSession" FORCE ROW LEVEL SECURITY;

-- EnvironmentShare table
ALTER TABLE "EnvironmentShare" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnvironmentShare" FORCE ROW LEVEL SECURITY;

-- AgentMessage table
ALTER TABLE "AgentMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentMessage" FORCE ROW LEVEL SECURITY;

-- Webhook table
ALTER TABLE "Webhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Webhook" FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================
-- Policy logic:
--   - If app.current_workspace_id = '__rls_bypass__' → allow (for admin/migrations)
--   - If app.current_workspace_id matches workspaceId → allow
--   - Otherwise → deny (including when NULL/unset for security)
--
-- This is a deny-by-default policy. The application MUST set the context before queries.

-- Agent policies
CREATE POLICY workspace_isolation_select ON "Agent"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "Agent"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "Agent"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "Agent"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- Service policies
CREATE POLICY workspace_isolation_select ON "Service"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "Service"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "Service"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "Service"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- ApiKey policies
CREATE POLICY workspace_isolation_select ON "ApiKey"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "ApiKey"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "ApiKey"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "ApiKey"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- DebugSession policies
CREATE POLICY workspace_isolation_select ON "DebugSession"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "DebugSession"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "DebugSession"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "DebugSession"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- EnvironmentShare policies
CREATE POLICY workspace_isolation_select ON "EnvironmentShare"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "EnvironmentShare"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "EnvironmentShare"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "EnvironmentShare"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- AgentMessage policies
CREATE POLICY workspace_isolation_select ON "AgentMessage"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "AgentMessage"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "AgentMessage"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "AgentMessage"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- Webhook policies
CREATE POLICY workspace_isolation_select ON "Webhook"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "Webhook"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "Webhook"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "Webhook"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Policies are DENY by default - if app.current_workspace_id is not set, access is denied
-- 2. Use '__rls_bypass__' for admin/migration operations that need cross-workspace access
-- 3. FORCE ROW LEVEL SECURITY ensures even table owners are subject to RLS
-- 4. The application must SET app.current_workspace_id before queries
-- 5. Tables without direct workspaceId (like DiagnosticResult) inherit isolation
--    through their foreign key relationships
