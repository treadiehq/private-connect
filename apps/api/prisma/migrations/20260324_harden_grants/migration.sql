-- Migration: Harden grant tokens + add access logging
-- 1. Replace plaintext token with SHA-256 hash (same pattern as ApiKey)
-- 2. Make expiresAt nullable (null = persistent grant)
-- 3. Create GrantAccessLog table

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: Add tokenHash and tokenPrefix columns (nullable for backfill)
ALTER TABLE "Grant" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "Grant" ADD COLUMN "tokenPrefix" TEXT;

-- Step 2: Backfill from existing plaintext token
UPDATE "Grant"
SET "tokenHash" = encode(digest("token", 'sha256'), 'hex'),
    "tokenPrefix" = left("token", 12);

-- Step 3: Make columns NOT NULL and add unique index
ALTER TABLE "Grant" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "Grant" ALTER COLUMN "tokenPrefix" SET NOT NULL;
CREATE UNIQUE INDEX "Grant_tokenHash_key" ON "Grant"("tokenHash");

-- Step 4: Drop the old plaintext token column and its index
DROP INDEX IF EXISTS "Grant_token_key";
DROP INDEX IF EXISTS "Grant_token_idx";
ALTER TABLE "Grant" DROP COLUMN "token";

-- Step 5: Make expiresAt nullable for persistent grants
ALTER TABLE "Grant" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- Step 6: Create GrantAccessLog table
CREATE TABLE "GrantAccessLog" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "requestSummary" TEXT,
    "responseStatus" TEXT,
    "allowed" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrantAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GrantAccessLog_grantId_createdAt_idx" ON "GrantAccessLog"("grantId", "createdAt" DESC);

ALTER TABLE "GrantAccessLog"
    ADD CONSTRAINT "GrantAccessLog_grantId_fkey"
    FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
