-- Phase 2b: Direct Messages

CREATE TABLE "Conversation" (
  "id"        TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationParticipant" (
  "id"             TEXT         NOT NULL,
  "conversationId" TEXT         NOT NULL,
  "userId"         TEXT         NOT NULL,
  "lastReadAt"     TIMESTAMP(3),
  "joinedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectMessage" (
  "id"             TEXT         NOT NULL,
  "conversationId" TEXT         NOT NULL,
  "senderId"       TEXT         NOT NULL,
  "body"           TEXT         NOT NULL,
  "deletedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key"
  ON "ConversationParticipant"("conversationId", "userId");

CREATE INDEX "ConversationParticipant_userId_idx"
  ON "ConversationParticipant"("userId");

CREATE INDEX "DirectMessage_conversationId_createdAt_idx"
  ON "DirectMessage"("conversationId", "createdAt");

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessage"
  ADD CONSTRAINT "DirectMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessage"
  ADD CONSTRAINT "DirectMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
