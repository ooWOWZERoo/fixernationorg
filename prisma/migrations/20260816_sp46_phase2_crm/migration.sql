-- SP-46: Phase 2 CRM — group/event audience rules + automation triggers

-- Add GROUP_JOIN and EVENT_RSVP to AutomationTrigger enum
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'GROUP_JOIN';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'EVENT_RSVP';
