ALTER TABLE "finance"."Asset"
  ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "groupType" TEXT,
  ADD COLUMN "parentAssetId" TEXT,
  ADD COLUMN "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
  ADD COLUMN "unitCost" DECIMAL(12,2);

UPDATE "finance"."Asset"
SET "unitCost" = COALESCE("currentValue", "purchaseCost", 0)
WHERE "unitCost" IS NULL;

ALTER TABLE "finance"."Asset"
  ADD CONSTRAINT "Asset_parentAssetId_fkey"
  FOREIGN KEY ("parentAssetId") REFERENCES "finance"."Asset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Asset_parentAssetId_idx" ON "finance"."Asset"("parentAssetId");
CREATE INDEX "Asset_isGroup_status_idx" ON "finance"."Asset"("isGroup", "status");
