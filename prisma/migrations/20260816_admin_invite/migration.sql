-- Admin invite flow: dedicated invite model for bootstrapping ADMIN/SUPER_ADMIN accounts
CREATE TABLE "AdminInvite" (
  "id"          TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "role"        "UserRole" NOT NULL,
  "token"       TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "claimedAt"   TIMESTAMP(3),
  "claimedById" TEXT,
  CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminInvite_token_key" ON "AdminInvite"("token");
CREATE INDEX "AdminInvite_email_idx"         ON "AdminInvite"("email");
CREATE INDEX "AdminInvite_token_idx"         ON "AdminInvite"("token");
