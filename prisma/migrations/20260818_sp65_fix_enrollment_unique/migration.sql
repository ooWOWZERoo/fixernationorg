-- Fix bug: a plain unique index on (userId, pathwayId/challengeId, status)
-- blocks a second WITHDRAWN row for the same user+resource, so the second
-- time a member unenrolls/abandons the same pathway/challenge, the update
-- fails with P2002 (Unique constraint failed). The real intent was only to
-- prevent two simultaneous ACTIVE enrollments — replace with a partial
-- unique index that only applies to ACTIVE rows.

DROP INDEX "PathwayEnrollment_userId_pathwayId_status_key";
CREATE UNIQUE INDEX "PathwayEnrollment_userId_pathwayId_active_key"
  ON "PathwayEnrollment"("userId", "pathwayId")
  WHERE "status" = 'ACTIVE';

DROP INDEX "ChallengeEnrollment_userId_challengeId_status_key";
CREATE UNIQUE INDEX "ChallengeEnrollment_userId_challengeId_active_key"
  ON "ChallengeEnrollment"("userId", "challengeId")
  WHERE "status" = 'ACTIVE';
