CREATE TABLE "spotlight_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spotlight_likes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "spotlight_likes_userId_storyId_key" ON "spotlight_likes"("userId", "storyId");
CREATE INDEX "spotlight_likes_storyId_idx" ON "spotlight_likes"("storyId");
ALTER TABLE "spotlight_likes" ADD CONSTRAINT "spotlight_likes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spotlight_likes" ADD CONSTRAINT "spotlight_likes_storyId_fkey"
    FOREIGN KEY ("storyId") REFERENCES "spotlight_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
