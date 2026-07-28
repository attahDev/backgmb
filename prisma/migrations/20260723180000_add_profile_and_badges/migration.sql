-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable: profile fields on users
ALTER TABLE "users"
  ADD COLUMN     "region" TEXT,
  ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable: badge auto-award criteria
-- metric/target get a temporary DEFAULT here only to satisfy any existing
-- rows in "badges" during the ALTER (the table has never been seeded, so in
-- practice this affects 0 rows) — schema.prisma does NOT declare a default
-- for either field, so the DROP DEFAULT below removes it again immediately
-- after, the same way Prisma resolves this itself when it prompts you for
-- a temporary value on a NOT NULL column added to a non-empty table.
ALTER TABLE "badges"
  ADD COLUMN     "metric" TEXT NOT NULL DEFAULT 'COURSES_COMPLETED',
  ADD COLUMN     "target" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "badges" ALTER COLUMN "metric" DROP DEFAULT;
ALTER TABLE "badges" ALTER COLUMN "target" DROP DEFAULT;
