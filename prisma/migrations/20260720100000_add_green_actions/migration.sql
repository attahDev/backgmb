CREATE TABLE "green_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "co2OffsetKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "green_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "green_actions_userId_idx" ON "green_actions"("userId");
CREATE INDEX "green_actions_createdAt_idx" ON "green_actions"("createdAt");
ALTER TABLE "green_actions" ADD CONSTRAINT "green_actions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
