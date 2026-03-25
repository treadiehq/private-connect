-- Add Row Level Security to Grant and GrantAccessLog tables.
-- Grant has a direct workspaceId column.
-- GrantAccessLog has no workspaceId; policies join through Grant.

-- ============================================================================
-- Grant
-- ============================================================================

ALTER TABLE "Grant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Grant" FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_select ON "Grant"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_insert ON "Grant"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_update ON "Grant"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

CREATE POLICY workspace_isolation_delete ON "Grant"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "workspaceId" = current_setting('app.current_workspace_id', true)
    );

-- ============================================================================
-- GrantAccessLog (joins through Grant for workspace ownership)
-- ============================================================================

ALTER TABLE "GrantAccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GrantAccessLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_select ON "GrantAccessLog"
    FOR SELECT
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "grantId" IN (
            SELECT id FROM "Grant"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_insert ON "GrantAccessLog"
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "grantId" IN (
            SELECT id FROM "Grant"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_update ON "GrantAccessLog"
    FOR UPDATE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "grantId" IN (
            SELECT id FROM "Grant"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );

CREATE POLICY workspace_isolation_delete ON "GrantAccessLog"
    FOR DELETE
    USING (
        current_setting('app.current_workspace_id', true) = '__rls_bypass__'
        OR "grantId" IN (
            SELECT id FROM "Grant"
            WHERE "workspaceId" = current_setting('app.current_workspace_id', true)
        )
    );
