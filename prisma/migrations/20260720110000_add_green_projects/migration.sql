CREATE TABLE "green_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "goalAmountMinor" INTEGER NOT NULL,
    "raisedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "green_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "green_project_support" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "green_project_support_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "green_project_support_userId_projectId_key" ON "green_project_support"("userId", "projectId");
ALTER TABLE "green_project_support" ADD CONSTRAINT "green_project_support_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "green_project_support" ADD CONSTRAINT "green_project_support_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "green_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
