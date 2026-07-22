-- CreateEnum
CREATE TYPE "OpportunitySource" AS ENUM ('MANUAL', 'API');

-- AlterTable: extend opportunities for admin manual entries + API sync,
-- and categories/search. `url` -> `applyUrl` (feature was never live behind
-- ComingSoon, so no data migration needed).
ALTER TABLE "opportunities" RENAME COLUMN "url" TO "applyUrl";

ALTER TABLE "opportunities"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "source" "OpportunitySource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_provider_externalId_key" ON "opportunities"("provider", "externalId");

-- CreateIndex
CREATE INDEX "opportunities_category_idx" ON "opportunities"("category");
