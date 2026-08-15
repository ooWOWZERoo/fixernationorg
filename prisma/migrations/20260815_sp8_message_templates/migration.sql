-- SP-8: Editable messaging templates for application lifecycle emails

CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "key"         TEXT NOT NULL PRIMARY KEY,
  "description" TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "variables"   TEXT[] NOT NULL DEFAULT '{}',
  "updatedBy"   TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Seed default templates (ON CONFLICT = admin edits are preserved)
INSERT INTO "MessageTemplate" ("key", "description", "subject", "body", "variables") VALUES

('application.submitted',
 'Sent to the applicant immediately after they submit.',
 'We received your application, {{first_name}}',
 E'Hi {{first_name}},\n\nThank you for applying to the Fixer Nation {{role}} program. Your application has been submitted and is waiting for a team member to review.\n\nWe''ll reach out here once we have an update. There''s nothing else you need to do right now.\n\nFixer Nation Team',
 ARRAY['first_name','role']
),

('application.under_review',
 'Sent when an admin moves the application to Under Review.',
 'Your {{role}} application is under review',
 E'Hi {{first_name}},\n\nWe''re going through your {{role}} application now. This typically takes a few business days.\n\nWe''ll follow up here when we have an update. No action is needed from you right now.\n\nFixer Nation Team',
 ARRAY['first_name','role']
),

('application.info_required',
 'Sent when an admin requests additional information.',
 'We have a question about your application',
 E'Hi {{first_name}},\n\nWe''re reviewing your {{role}} application and need a bit more information before we can move forward.\n\n{{info_request_notes}}\n\nPlease reply to this email or visit fixernation.org/contact to get back to us.\n\nFixer Nation Team',
 ARRAY['first_name','role','info_request_notes']
),

('application.conditionally_accepted',
 'Sent on conditional acceptance — includes any next-steps notes.',
 'Good news about your {{role}} application',
 E'Hi {{first_name}},\n\nYour {{role}} application has been conditionally accepted. We''d like to move forward, and there are a few things to wrap up first.\n\n{{review_notes}}\n\nReply to this email if you have questions.\n\nFixer Nation Team',
 ARRAY['first_name','role','review_notes']
),

('application.accepted',
 'Sent when an application is fully accepted and onboarding begins.',
 'You''ve been accepted — let''s get you set up',
 E'Hi {{first_name}},\n\nWe''re pleased to accept your {{role}} application. Welcome to Fixer Nation.\n\nA team member will be in touch shortly with your next onboarding steps. Keep an eye on this inbox.\n\nFixer Nation Team',
 ARRAY['first_name','role']
),

('application.declined',
 'Sent when an application is declined or rejected.',
 'Your Fixer Nation application',
 E'Hi {{first_name}},\n\nThank you for your interest in the Fixer Nation {{role}} program. After reviewing your application, we''re not able to move forward at this time.\n\nThis decision doesn''t prevent you from reapplying in the future. If you have questions, reply to this email.\n\nFixer Nation Team',
 ARRAY['first_name','role']
),

('application.expired',
 'Sent when an onboarding application expires due to inactivity.',
 'Your Fixer Nation application has expired',
 E'Hi {{first_name}},\n\nYour {{role}} application with Fixer Nation has expired due to inactivity. We hadn''t heard from you in a while, so we''ve closed the application automatically.\n\nIf you''re still interested, you''re welcome to reapply. Your previous information won''t be lost, and our team will review your new application.\n\nIf you have questions or think this is a mistake, reply to this email.\n\nFixer Nation Team',
 ARRAY['first_name','role']
),

('application.withdrawn',
 'Sent when an applicant withdraws their application.',
 'Your Fixer Nation application has been withdrawn',
 E'Hi {{first_name}},\n\nWe''ve received your withdrawal request for your Fixer Nation {{role}} application. Your application has been closed and all pending reminders have been stopped.\n\nYou''re welcome to reapply in the future. If you withdrew by mistake or have questions, reply to this email.\n\nFixer Nation Team',
 ARRAY['first_name','role']
),

('application.expiration_reminder',
 'Sent 14 or 7 days before an accepted application expires.',
 'Your Fixer Nation application expires {{deadline}}',
 E'Hi {{first_name}},\n\nJust a heads-up — your {{role}} application with Fixer Nation expires {{deadline}}.\n\nWe accepted your application and started the onboarding process, but we still need a few things from you to complete it. If we don''t hear back before the deadline, the application will close automatically.\n\nTo pick up where you left off, sign in at fixernation.org or reply to this email.\n\nFixer Nation Team',
 ARRAY['first_name','role','deadline']
),

('activation.welcome',
 'Sent when an application is marked Active and the applicant becomes a partner.',
 'Welcome to Fixer Nation, {{first_name}}',
 E'Hi {{first_name}},\n\nCongratulations — your {{role}} account is now active. Welcome to Fixer Nation.\n\nSign in at fixernation.org to access your dashboard, profile, and tools. If you have any questions as you get started, reply to this email.\n\nFixer Nation Team',
 ARRAY['first_name','role']
)

ON CONFLICT ("key") DO NOTHING;
