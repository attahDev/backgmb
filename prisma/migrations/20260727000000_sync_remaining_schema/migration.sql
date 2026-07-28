-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('GENERAL', 'HALL_OF_FAME');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('COMMUNITY', 'EVENTS', 'MENTORS', 'OPPORTUNITIES', 'COURSES', 'GREEN_IMPACT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MENTOR';

-- AlterTable
ALTER TABLE "business_plans" ADD COLUMN     "sourceIdeaId" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "audience" "EventAudience" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "recap" JSONB;

-- AlterTable
ALTER TABLE "mentors" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "opportunities" DROP COLUMN "createdAt",
DROP COLUMN "imageUrl",
DROP COLUMN "updatedAt",
ADD COLUMN     "url" TEXT,
DROP COLUMN "source",
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "spotlight_stories" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "authorId" TEXT,
ALTER COLUMN "isPublished" SET DEFAULT false;

-- DropEnum
DROP TYPE "OpportunitySource";

-- CreateTable
CREATE TABLE "mentee_messages" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentee_messages_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "mentor_sessions" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "proposedFor" TIMESTAMP(3) NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "durationMins" INTEGER,
    "agenda" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "mentorNotes" TEXT,
    "menteeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_spotlights" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "shoutout" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_spotlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_logs" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "menteeId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "notes" TEXT,
    "confirmedByMentor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_paths" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_path_skills" (
    "id" TEXT NOT NULL,
    "careerPathId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "career_path_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentee_career_goals" (
    "id" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "careerPathId" TEXT NOT NULL,
    "aiSummary" TEXT,
    "aiSummaryAt" TIMESTAMP(3),
    "aiSummarySkillsCount" INTEGER,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentee_career_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentee_messages_connectionId_idx" ON "mentee_messages"("connectionId");

-- CreateIndex
CREATE INDEX "comments_storyId_idx" ON "comments"("storyId");

-- CreateIndex
CREATE INDEX "notifications_audience_userId_idx" ON "notifications"("audience", "userId");

-- CreateIndex
CREATE INDEX "notifications_audience_isRead_idx" ON "notifications"("audience", "isRead");

-- CreateIndex
CREATE INDEX "mentor_sessions_connectionId_idx" ON "mentor_sessions"("connectionId");

-- CreateIndex
CREATE INDEX "mentor_sessions_status_idx" ON "mentor_sessions"("status");

-- CreateIndex
CREATE INDEX "mentor_spotlights_isActive_idx" ON "mentor_spotlights"("isActive");

-- CreateIndex
CREATE INDEX "mentor_spotlights_startDate_idx" ON "mentor_spotlights"("startDate");

-- CreateIndex
CREATE INDEX "skill_logs_connectionId_idx" ON "skill_logs"("connectionId");

-- CreateIndex
CREATE INDEX "skill_logs_menteeId_idx" ON "skill_logs"("menteeId");

-- CreateIndex
CREATE INDEX "skill_logs_sessionId_idx" ON "skill_logs"("sessionId");

-- CreateIndex
CREATE INDEX "career_path_skills_careerPathId_idx" ON "career_path_skills"("careerPathId");

-- CreateIndex
CREATE UNIQUE INDEX "mentee_career_goals_menteeId_key" ON "mentee_career_goals"("menteeId");

-- CreateIndex
CREATE INDEX "events_audience_idx" ON "events"("audience");

-- CreateIndex
CREATE UNIQUE INDEX "mentors_userId_key" ON "mentors"("userId");

-- CreateIndex
CREATE INDEX "opportunities_isFeatured_idx" ON "opportunities"("isFeatured");

-- CreateIndex
CREATE INDEX "spotlight_stories_status_idx" ON "spotlight_stories"("status");

-- CreateIndex
CREATE INDEX "spotlight_stories_status_approvedAt_idx" ON "spotlight_stories"("status", "approvedAt");

-- AddForeignKey
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_messages" ADD CONSTRAINT "mentee_messages_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mentor_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_messages" ADD CONSTRAINT "mentee_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spotlight_stories" ADD CONSTRAINT "spotlight_stories_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "spotlight_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_sessions" ADD CONSTRAINT "mentor_sessions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mentor_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_spotlights" ADD CONSTRAINT "mentor_spotlights_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_logs" ADD CONSTRAINT "skill_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mentor_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_logs" ADD CONSTRAINT "skill_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mentor_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_logs" ADD CONSTRAINT "skill_logs_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_skills" ADD CONSTRAINT "career_path_skills_careerPathId_fkey" FOREIGN KEY ("careerPathId") REFERENCES "career_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_career_goals" ADD CONSTRAINT "mentee_career_goals_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_career_goals" ADD CONSTRAINT "mentee_career_goals_careerPathId_fkey" FOREIGN KEY ("careerPathId") REFERENCES "career_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

