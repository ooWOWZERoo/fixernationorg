-- SP-67 Stage 2: Seed MessageTemplate rows for Stripe-triggered membership
-- lifecycle emails (purchase thank-you, renewal receipt, payment failed,
-- cancellation) plus the Stage 3 date-scan reminder templates (renewal and
-- gift-expiring, 30/7 day). Idempotent — safe to re-run.

INSERT INTO "MessageTemplate" ("key", "description", "subject", "body", "variables", "updatedAt")
VALUES
(
  'membership.purchase_thankyou',
  'Membership purchase thank-you',
  E'You''re in. Welcome to Fixer Nation.',
  E'Hey {{first_name}},\n\nYour {{plan_name}} membership is active. Thanks for joining.\n\nHere''s what you get right away: Morning Boost, the full resource library, community groups, and everything else that comes with membership.\n\nManage your plan or update your card anytime at {{billing_url}}.\n\nGlad you''re here.\nThe Fixer Nation team',
  ARRAY['first_name','plan_name','billing_url'],
  NOW()
),
(
  'membership.renewal_reminder_30',
  'Renewal reminder (30 days out, paid Stripe membership)',
  'Your membership renews in 30 days',
  E'Hey {{first_name}},\n\nQuick heads up. Your {{plan_name}} membership renews on {{renewal_date}}. You''ll be charged {{amount}} automatically, same card as before.\n\nNothing to do if that''s all good. Want to change your plan or update payment info first? Head to {{billing_url}}.\n\nThe Fixer Nation team',
  ARRAY['first_name','plan_name','renewal_date','amount','billing_url'],
  NOW()
),
(
  'membership.renewal_reminder_7',
  'Renewal reminder (7 days out, paid Stripe membership)',
  'Your membership renews in 7 days',
  E'Hey {{first_name}},\n\nOne week out. Your {{plan_name}} membership renews on {{renewal_date}} for {{amount}}.\n\nIf everything looks right, you don''t need to do anything. Want to make a change first? Head to {{billing_url}}.\n\nThe Fixer Nation team',
  ARRAY['first_name','plan_name','renewal_date','amount','billing_url'],
  NOW()
),
(
  'membership.gift_expiring_30',
  'Free gift membership expiring (30 days out)',
  'Your free membership ends in 30 days',
  E'Hey {{first_name}},\n\nYour free 90-day membership from your book purchase ends on {{renewal_date}}. After that, you''ll lose access to Morning Boost, the resource library, and community groups.\n\nWant to keep it going? Upgrade to a paid membership anytime at {{upgrade_url}}. No interruption, no starting over.\n\nThe Fixer Nation team',
  ARRAY['first_name','renewal_date','upgrade_url'],
  NOW()
),
(
  'membership.gift_expiring_7',
  'Free gift membership expiring (7 days out)',
  'Your free membership ends in 7 days',
  E'Hey {{first_name}},\n\nOne week left on your free membership. It ends {{renewal_date}}.\n\nWant to keep your access? Upgrade at {{upgrade_url}} before it lapses.\n\nThe Fixer Nation team',
  ARRAY['first_name','renewal_date','upgrade_url'],
  NOW()
),
(
  'membership.payment_failed',
  'Membership renewal payment failed',
  E'We couldn''t process your membership payment',
  E'Hey {{first_name}},\n\nYour card was declined when we tried to renew your {{plan_name}} membership. Your access hasn''t changed yet, but we''ll need an updated payment method soon to keep it that way.\n\nUpdate your card at {{billing_url}}.\n\nThe Fixer Nation team',
  ARRAY['first_name','plan_name','billing_url'],
  NOW()
),
(
  'membership.renewal_receipt',
  'Membership renewal receipt',
  'Your membership renewed',
  E'Hey {{first_name}},\n\nYour {{plan_name}} membership just renewed. {{amount}} was charged to your card on file, and you''re set through {{renewal_date}}.\n\nFull billing history and receipts are at {{billing_url}}.\n\nThe Fixer Nation team',
  ARRAY['first_name','plan_name','amount','renewal_date','billing_url'],
  NOW()
),
(
  'membership.canceled',
  'Membership canceled confirmation',
  'Your Fixer Nation membership has been canceled',
  E'Hey {{first_name}},\n\nYour {{plan_name}} membership is canceled, effective now. You''ll keep the free-tier features, but member-only content and groups are no longer available.\n\nChanged your mind? You can resubscribe anytime at {{upgrade_url}}.\n\nThe Fixer Nation team',
  ARRAY['first_name','plan_name','upgrade_url'],
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
