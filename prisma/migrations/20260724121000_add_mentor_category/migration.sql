-- AlterTable
ALTER TABLE "mentors" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'General';

-- CreateIndex
CREATE INDEX "mentors_category_idx" ON "mentors"("category");
