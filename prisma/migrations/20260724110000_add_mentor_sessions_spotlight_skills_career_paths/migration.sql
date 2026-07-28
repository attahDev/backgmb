-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

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