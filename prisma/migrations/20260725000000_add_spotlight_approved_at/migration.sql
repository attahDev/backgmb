-- AlterTable
ALTER TABLE "spotlight_stories" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "spotlight_stories_status_approvedAt_idx" ON "spotlight_stories"("status", "approvedAt");
