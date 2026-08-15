-- SP-9: Account activation invitation fields
ALTER TABLE "UserApplication"
  ADD COLUMN IF NOT EXISTS "accountInviteToken"     TEXT,
  ADD COLUMN IF NOT EXISTS "accountInviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accountInviteSentAt"    TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "UserApplication_accountInviteToken_key"
  ON "UserApplication"("accountInviteToken");

-- Seed account invitation template
INSERT INTO "MessageTemplate" ("key", "description", "subject", "body", "variables")
VALUES (
  'account.invitation',
  'Sent to accepted applicants who do not yet have a Fixer Nation account.',
  'Set up your Fixer Nation account',
  E'Hi {{first_name}},\n\nYour {{role}} application has been accepted. Before we can move forward with onboarding, you''ll need to create your Fixer Nation account.\n\nClick the link below to set your password and activate your account. This link expires in 7 days.\n\n{{invite_url}}\n\nIf you didn''t apply to the Fixer Nation {{role}} program, you can ignore this email.\n\nFixer Nation Team',
  ARRAY['first_name', 'role', 'invite_url']
)
ON CONFLICT ("key") DO NOTHING;
