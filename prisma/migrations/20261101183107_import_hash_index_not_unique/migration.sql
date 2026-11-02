-- DropIndex
DROP INDEX "uq_import_source_hash";

-- CreateIndex
CREATE INDEX "idx_import_source_hash" ON "import_batches"("source_hash");
