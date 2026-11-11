-- DropIndex
DROP INDEX "Note_carrierId_updatedAt_idx";

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Note_carrierId_position_idx" ON "Note"("carrierId", "position");

-- Keep each carrier's current order (most recently edited first).
UPDATE "Note" n
SET "position" = ranked.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "carrierId" ORDER BY "updatedAt" DESC) - 1 AS rn
  FROM "Note"
) ranked
WHERE n.id = ranked.id;
