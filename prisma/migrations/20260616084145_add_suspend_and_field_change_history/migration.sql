-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "field_change_history" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "actorType" "ActorType" NOT NULL DEFAULT 'ADMIN',
    "userId" TEXT,
    "alumniId" TEXT,
    "actorName" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_change_history_resourceType_resourceId_field_createdA_idx" ON "field_change_history"("resourceType", "resourceId", "field", "createdAt");

-- CreateIndex
CREATE INDEX "field_change_history_resourceType_resourceId_idx" ON "field_change_history"("resourceType", "resourceId");
