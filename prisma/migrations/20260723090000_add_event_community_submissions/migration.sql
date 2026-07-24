-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "source" "EventSource" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "events" ADD COLUMN "reviewStatus" "PostStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "events" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "events_reviewStatus_idx" ON "events"("reviewStatus");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
