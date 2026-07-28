/*
  Warnings:

  - Added the required column `metric` to the `badges` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target` to the `badges` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "badges" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metric" TEXT NOT NULL,
ADD COLUMN     "target" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "region" TEXT;
