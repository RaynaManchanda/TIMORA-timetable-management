-- AlterTable
ALTER TABLE "google_calendar_connections" ADD COLUMN     "synced_event_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "user_electives" (
    "user_id" VARCHAR(64) NOT NULL,
    "subject_id" VARCHAR(64) NOT NULL,

    CONSTRAINT "user_electives_pkey" PRIMARY KEY ("user_id","subject_id")
);

-- AddForeignKey
ALTER TABLE "user_electives" ADD CONSTRAINT "user_electives_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_electives" ADD CONSTRAINT "user_electives_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
