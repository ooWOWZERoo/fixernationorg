-- SP-29: Journey Builder Canvas
-- Add new step types to AutomationStepType enum
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL
ALTER TYPE "AutomationStepType" ADD VALUE IF NOT EXISTS 'REMOVE_TAG';
ALTER TYPE "AutomationStepType" ADD VALUE IF NOT EXISTS 'SEND_PUSH';
ALTER TYPE "AutomationStepType" ADD VALUE IF NOT EXISTS 'CONDITION';
ALTER TYPE "AutomationStepType" ADD VALUE IF NOT EXISTS 'EXIT';

-- Add canvas position columns to AutomationStep
ALTER TABLE "AutomationStep" ADD COLUMN IF NOT EXISTS "posX" DOUBLE PRECISION;
ALTER TABLE "AutomationStep" ADD COLUMN IF NOT EXISTS "posY" DOUBLE PRECISION;
