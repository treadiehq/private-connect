-- Pre-push cleanup: drop legacy columns/indexes that block prisma db push.
-- Runs before `prisma db push` in the deploy start command.
-- Each statement uses IF EXISTS so this is safe to re-run.

-- The hash_api_keys migration added keyHash and should have dropped the
-- plaintext `key` column, but prisma db push can't drop the index if the
-- current role doesn't own it. Drop explicitly first.
DROP INDEX IF EXISTS "ApiKey_key_key";
ALTER TABLE "ApiKey" DROP COLUMN IF EXISTS "key";
