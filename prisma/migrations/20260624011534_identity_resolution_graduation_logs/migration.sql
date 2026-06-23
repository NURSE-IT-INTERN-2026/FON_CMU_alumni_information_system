-- AlterEnum
ALTER TYPE "ActorType" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "nameManuallyUpdated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "field_change_history" ADD COLUMN     "activityLogId" TEXT;

-- CreateIndex
CREATE INDEX "field_change_history_activityLogId_idx" ON "field_change_history"("activityLogId");

-- AddForeignKey
ALTER TABLE "field_change_history" ADD CONSTRAINT "field_change_history_activityLogId_fkey" FOREIGN KEY ("activityLogId") REFERENCES "activity_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
