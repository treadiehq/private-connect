-- CreateTable
CREATE TABLE "ServiceGroup" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceGroup_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "Service" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceGroup_workspaceId_idx" ON "ServiceGroup"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceGroup_workspaceId_name_key" ON "ServiceGroup"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Service_groupId_idx" ON "Service"("groupId");

-- AddForeignKey
ALTER TABLE "ServiceGroup" ADD CONSTRAINT "ServiceGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ServiceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
