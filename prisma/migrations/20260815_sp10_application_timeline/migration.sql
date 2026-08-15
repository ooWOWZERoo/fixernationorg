-- SP-10: Application activity timeline
CREATE TABLE "ApplicationEvent" (
  "id"            TEXT         NOT NULL,
  "applicationId" TEXT         NOT NULL,
  "type"          TEXT         NOT NULL,
  "actor"         TEXT,
  "meta"          JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationEvent_applicationId_fkey"
    FOREIGN KEY ("applicationId")
    REFERENCES "UserApplication"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "ApplicationEvent_applicationId_createdAt_idx"
  ON "ApplicationEvent"("applicationId", "createdAt" DESC);
