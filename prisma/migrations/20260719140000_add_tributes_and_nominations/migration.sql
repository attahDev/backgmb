-- Legacy Tributes: any logged-in user can post a shoutout, visible to
-- everyone immediately (no approval gate — that's deliberate, see PR
-- notes). Admins can still delete an individual tribute via
-- DELETE /tributes/:id for moderation.
CREATE TABLE "tributes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tributes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tributes_createdAt_idx" ON "tributes"("createdAt");
ALTER TABLE "tributes" ADD CONSTRAINT "tributes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nominations: submitted PENDING, only show as a "Recent Nomination" once
-- an admin sets status to APPROVED via PATCH /nominations/:id/status.
CREATE TABLE "nominations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "nomineeName" TEXT NOT NULL,
    "category" TEXT,
    "story" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nominations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "nominations_status_idx" ON "nominations"("status");
CREATE INDEX "nominations_createdAt_idx" ON "nominations"("createdAt");
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
