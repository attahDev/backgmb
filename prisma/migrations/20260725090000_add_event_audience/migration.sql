-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('GENERAL', 'HALL_OF_FAME');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "audience" "EventAudience" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "events_audience_idx" ON "events"("audience");
