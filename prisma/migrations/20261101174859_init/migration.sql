-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COORDINATOR', 'FACULTY', 'STUDENT');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'LAB', 'SEMINAR_HALL');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('LECTURE', 'LAB', 'TUTORIAL');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('LECTURE', 'LAB', 'TUTORIAL', 'PROJECT');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DRAFT');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('LUNCH', 'MENTORING', 'MINOR', 'INDUSTRY_EXPERT', 'OTHER');

-- CreateEnum
CREATE TYPE "DisruptionStatus" AS ENUM ('RECORDED', 'ANALYZED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "CalendarAuthStatus" AS ENUM ('ACTIVE', 'REAUTH_REQUIRED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "time_slots" (
    "id" VARCHAR(8) NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "label" VARCHAR(32) NOT NULL,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "program" VARCHAR(128) NOT NULL,
    "semester" INTEGER NOT NULL,
    "student_count" INTEGER NOT NULL,
    "batch" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "department" VARCHAR(128) NOT NULL,
    "max_hours_per_week" INTEGER NOT NULL DEFAULT 18,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "building" VARCHAR(128) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "type" "RoomType" NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" VARCHAR(64) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "abbreviation" VARCHAR(32),
    "department" VARCHAR(128),
    "type" "SubjectType" NOT NULL,
    "category" VARCHAR(64),
    "ldp" VARCHAR(16),
    "required_hours_per_week" INTEGER NOT NULL DEFAULT 3,
    "credits" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "department" VARCHAR(128),
    "section_id" VARCHAR(64),
    "faculty_id" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_versions" (
    "id" VARCHAR(64) NOT NULL,
    "version_number" VARCHAR(32) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "parent_version_id" VARCHAR(64),
    "disruption_id" VARCHAR(64),
    "approved_by" VARCHAR(128) NOT NULL,
    "change_log" TEXT,
    "quality_score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetable_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_entries" (
    "id" VARCHAR(64) NOT NULL,
    "version_id" VARCHAR(64) NOT NULL,
    "section_id" VARCHAR(64) NOT NULL,
    "co_section_ids" VARCHAR(64)[] DEFAULT ARRAY[]::VARCHAR(64)[],
    "subject_id" VARCHAR(64) NOT NULL,
    "faculty_id" VARCHAR(64) NOT NULL,
    "room_id" VARCHAR(64) NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "slot_id" VARCHAR(8) NOT NULL,
    "session_type" "SessionType" NOT NULL DEFAULT 'LECTURE',
    "is_elective" BOOLEAN NOT NULL DEFAULT false,
    "room_exclusive" BOOLEAN NOT NULL DEFAULT true,
    "source_cell" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_blocks" (
    "id" VARCHAR(64) NOT NULL,
    "section_id" VARCHAR(64) NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "slot_id" VARCHAR(8) NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "label" VARCHAR(255) NOT NULL,

    CONSTRAINT "section_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disruptions" (
    "id" VARCHAR(64) NOT NULL,
    "disruption_type" VARCHAR(64) NOT NULL,
    "affected_entity_type" VARCHAR(64) NOT NULL,
    "affected_entity_id" VARCHAR(64) NOT NULL,
    "affected_entity_name" VARCHAR(128),
    "day_of_week" VARCHAR(32) NOT NULL,
    "date" VARCHAR(16),
    "slot_id" VARCHAR(8),
    "reason" TEXT,
    "reported_by" VARCHAR(128),
    "status" "DisruptionStatus" NOT NULL DEFAULT 'RECORDED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "disruptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_logs" (
    "id" VARCHAR(64) NOT NULL,
    "disruption_id" VARCHAR(64) NOT NULL,
    "alternative_id" VARCHAR(64) NOT NULL,
    "approved_version_id" VARCHAR(64) NOT NULL,
    "approved_by" VARCHAR(128) NOT NULL,
    "notes" TEXT,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "role" VARCHAR(32) NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "old_slot" VARCHAR(64),
    "new_slot" VARCHAR(64),
    "day_of_week" VARCHAR(32),
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_connections" (
    "user_id" VARCHAR(64) NOT NULL,
    "google_account_email" VARCHAR(255),
    "auth_status" "CalendarAuthStatus" NOT NULL DEFAULT 'ACTIVE',
    "token_expires_at" TIMESTAMPTZ(6),
    "can_refresh_token" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMPTZ(6),
    "events_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" VARCHAR(64) NOT NULL,
    "source_file" VARCHAR(255) NOT NULL,
    "source_hash" VARCHAR(64) NOT NULL,
    "version_id" VARCHAR(64),
    "summary" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_slot_number_key" ON "time_slots"("slot_number");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_email_key" ON "faculty"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_section" ON "users"("section_id");

-- CreateIndex
CREATE INDEX "idx_users_faculty" ON "users"("faculty_id");

-- CreateIndex
CREATE INDEX "idx_login_attempts_email_time" ON "login_attempts"("email", "attempted_at");

-- CreateIndex
CREATE INDEX "idx_entries_section_day" ON "timetable_entries"("version_id", "section_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "uq_section_block" ON "section_blocks"("section_id", "day_of_week", "slot_id", "kind");

-- CreateIndex
CREATE INDEX "idx_notifications_user_status" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_import_source_hash" ON "import_batches"("source_hash");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "timetable_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_disruption_id_fkey" FOREIGN KEY ("disruption_id") REFERENCES "disruptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "timetable_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_blocks" ADD CONSTRAINT "section_blocks_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_blocks" ADD CONSTRAINT "section_blocks_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_disruption_id_fkey" FOREIGN KEY ("disruption_id") REFERENCES "disruptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_approved_version_id_fkey" FOREIGN KEY ("approved_version_id") REFERENCES "timetable_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express (hand-written, keep them in any future migration).
-- ---------------------------------------------------------------------------

-- At most one timetable version can be ACTIVE at any time.
CREATE UNIQUE INDEX "uq_single_active_version"
    ON "timetable_versions" ("status") WHERE "status" = 'ACTIVE';

-- A section has at most one core (non-elective) class per slot. Elective classes run in
-- parallel by design, so they are excluded from this rule.
CREATE UNIQUE INDEX "uq_section_core_slot"
    ON "timetable_entries" ("version_id", "section_id", "day_of_week", "slot_id")
    WHERE "is_elective" = FALSE;

-- A room hosts one class per slot, except shared facilities such as workshops.
CREATE UNIQUE INDEX "uq_room_day_slot_version"
    ON "timetable_entries" ("version_id", "room_id", "day_of_week", "slot_id")
    WHERE "room_exclusive";

-- A teacher teaches one class per slot. Project guidance is given by a panel, so it is excluded.
CREATE UNIQUE INDEX "uq_faculty_day_slot_version"
    ON "timetable_entries" ("version_id", "faculty_id", "day_of_week", "slot_id")
    WHERE "session_type" <> 'PROJECT';

-- room_exclusive always follows the room, whoever writes the entry.
CREATE FUNCTION set_entry_room_exclusive() RETURNS trigger AS $$
BEGIN
    NEW."room_exclusive" := NOT COALESCE((SELECT "is_shared" FROM "rooms" WHERE "id" = NEW."room_id"), FALSE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_entry_room_exclusive"
    BEFORE INSERT OR UPDATE OF "room_id" ON "timetable_entries"
    FOR EACH ROW EXECUTE FUNCTION set_entry_room_exclusive();
