DROP INDEX IF EXISTS "finance"."FeeCategory_name_key";
CREATE UNIQUE INDEX "FeeCategory_schoolId_name_key" ON "finance"."FeeCategory"("schoolId", "name");
DROP INDEX IF EXISTS "finance"."FeeCategory_code_key";
CREATE UNIQUE INDEX "FeeCategory_schoolId_code_key" ON "finance"."FeeCategory"("schoolId", "code");
DROP INDEX IF EXISTS "finance"."StudentGroup_code_key";
CREATE UNIQUE INDEX "StudentGroup_schoolId_code_key" ON "finance"."StudentGroup"("schoolId", "code");
DROP INDEX IF EXISTS "finance"."StoreItem_itemCode_key";
CREATE UNIQUE INDEX "StoreItem_schoolId_itemCode_key" ON "finance"."StoreItem"("schoolId", "itemCode");
