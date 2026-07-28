-- CreateTable
CREATE TABLE "mentee_messages" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentee_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentee_messages_connectionId_idx" ON "mentee_messages"("connectionId");

-- AddForeignKey
ALTER TABLE "mentee_messages" ADD CONSTRAINT "mentee_messages_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mentor_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_messages" ADD CONSTRAINT "mentee_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
