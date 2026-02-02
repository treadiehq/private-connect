-- Setup script for RLS-enforced application role
-- Run this ONCE on your production database as superuser before deploying

-- Create application role with RLS enforcement
-- Replace 'YOUR_SECURE_PASSWORD' with a strong password for production
DROP ROLE IF EXISTS privateconnect_app;
CREATE ROLE privateconnect_app LOGIN PASSWORD 'YOUR_SECURE_PASSWORD' NOBYPASSRLS;

-- Grant schema access
GRANT USAGE ON SCHEMA public TO privateconnect_app;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO privateconnect_app;

-- Grant sequence permissions (needed for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO privateconnect_app;

-- Set default privileges for future tables created by the migration user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO privateconnect_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO privateconnect_app;

-- Verify the role was created correctly
SELECT rolname, rolsuper, rolbypassrls 
FROM pg_roles 
WHERE rolname = 'privateconnect_app';

-- Expected output:
--       rolname       | rolsuper | rolbypassrls 
-- --------------------+----------+--------------
--  privateconnect_app | f        | f
