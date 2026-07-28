-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "NotificationCategory" AS ENUM ('COMMUNITY', 'EVENTS', 'MENTORS', 'OPPORTUNITIES', 'COURSES', 'GREEN_IMPACT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MENTOR';

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "userId" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "spotlight_stories" ADD COLUMN "authorId" TEXT;
ALTER TABLE "opportunities" ADD COLUMN "url" TEXT;
ALTER TABLE "business_plans" ADD COLUMN "sourceIdeaId" TEXT;
ALTER TABLE "mentors" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "notifications_audience_userId_idx" ON "notifications"("audience", "userId");
CREATE INDEX "notifications_audience_isRead_idx" ON "notifications"("audience", "isRead");
CREATE INDEX "comments_storyId_idx" ON "comments"("storyId");
CREATE UNIQUE INDEX "mentors_userId_key" ON "mentors"("userId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "spotlight_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "spotlight_stories" ADD CONSTRAINT "spotlight_stories_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;