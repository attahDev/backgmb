-- AlterTable
-- The `sourceIdeaId` field has existed on the BusinessPlan model in schema.prisma
-- since the idea-engine cross-link was added, but no migration ever created the
-- column in the database. This is why BusinessPlannerService.getHistory() (a
-- plain `findMany`, which selects every model field) throws and surfaces as a
-- 500 on GET /business-planner/history.
ALTER TABLE "business_plans" ADD COLUMN "sourceIdeaId" TEXT;
