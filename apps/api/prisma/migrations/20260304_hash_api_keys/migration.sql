-- Migration: Hash API keys
-- Replaces the plaintext `key` column with a SHA-256 `keyHash` column.
-- The raw key is never stored after this migration.

-- Step 1: Add the new keyHash column (nullable initially so we can backfill)
ALTER TABLE "ApiKey" ADD COLUMN "keyHash" TEXT;

-- Step 2: Backfill keyHash for all existing rows by hashing the plaintext key.
-- encode(digest(key, 'sha256'), 'hex') uses the pgcrypto extension.
-- If pgcrypto is not available, run: CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "ApiKey" SET "keyHash" = encode(digest("key", 'sha256'), 'hex');

-- Step 3: Make keyHash NOT NULL and add the unique constraint
ALTER TABLE "ApiKey" ALTER COLUMN "keyHash" SET NOT NULL;
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- Step 4: Drop the old plaintext key column
ALTER TABLE "ApiKey" DROP COLUMN "key";
