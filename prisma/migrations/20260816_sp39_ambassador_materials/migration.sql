-- SP-39: Ambassador campaign materials
ALTER TABLE "Campaign" ADD COLUMN "isAmbassadorMaterial" BOOLEAN NOT NULL DEFAULT false;
