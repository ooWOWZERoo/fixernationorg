-- Phase 2c: Social Profiles + username on User

-- Add username to User
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Create SocialProfile table
CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialProfile_userId_key" ON "SocialProfile"("userId");

ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
