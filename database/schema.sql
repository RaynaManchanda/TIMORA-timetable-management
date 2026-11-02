-- ============================================================================
-- TIMORA - PostgreSQL 16 schema
-- Idempotent: safe to run on every start-up (no DROP statements).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sections (
    id            VARCHAR(64)  PRIMARY KEY,
    name          VARCHAR(128) NOT NULL,
    program       VARCHAR(128) NOT NULL,
    semester      INT          NOT NULL CHECK (semester BETWEEN 1 AND 10),
    student_count INT          NOT NULL CHECK (student_count > 0),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculty (
    id                 VARCHAR(64)  PRIMARY KEY,
    name               VARCHAR(128) NOT NULL,
    email              VARCHAR(255) NOT NULL UNIQUE,
    department         VARCHAR(128) NOT NULL,
    max_hours_per_week INT          NOT NULL DEFAULT 18,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id         VARCHAR(64)  PRIMARY KEY,
    name       VARCHAR(128) NOT NULL,
    building   VARCHAR(128) NOT NULL,
    capacity   INT          NOT NULL CHECK (capacity > 0),
    type       VARCHAR(32)  NOT NULL CHECK (type IN ('CLASSROOM', 'LAB', 'SEMINAR_HALL')),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
    id                      VARCHAR(64)  PRIMARY KEY,
    code                    VARCHAR(32)  NOT NULL UNIQUE,
    name                    VARCHAR(255) NOT NULL,
    department              VARCHAR(128),
    type                    VARCHAR(32)  NOT NULL CHECK (type IN ('LECTURE', 'LAB', 'TUTORIAL')),
    required_hours_per_week INT          NOT NULL DEFAULT 3,
    credits                 INT          NOT NULL DEFAULT 3,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR(64)  PRIMARY KEY,
    name          VARCHAR(128) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(32)  NOT NULL CHECK (role IN ('ADMIN', 'COORDINATOR', 'FACULTY', 'STUDENT')),
    department    VARCHAR(128),
    section_id    VARCHAR(64)  REFERENCES sections(id) ON DELETE SET NULL,
    faculty_id    VARCHAR(64)  REFERENCES faculty(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_section ON users (section_id);
CREATE INDEX IF NOT EXISTS idx_users_faculty ON users (faculty_id);

-- Failed login attempts used by the login rate limiter.
CREATE TABLE IF NOT EXISTS login_attempts (
    id           BIGSERIAL    PRIMARY KEY,
    email        VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts (email, attempted_at);

CREATE TABLE IF NOT EXISTS disruptions (
    id                   VARCHAR(64)  PRIMARY KEY,
    type                 VARCHAR(64)  NOT NULL,
    affected_entity_type VARCHAR(64)  NOT NULL,
    affected_entity_id   VARCHAR(64)  NOT NULL,
    affected_entity_name VARCHAR(128),
    day_of_week          VARCHAR(32)  NOT NULL,
    slot_id              VARCHAR(32),
    reason               TEXT,
    reported_by          VARCHAR(128),
    status               VARCHAR(32)  NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING', 'ANALYZED', 'RESOLVED', 'REJECTED')),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS timetable_versions (
    id                VARCHAR(64)  PRIMARY KEY,
    version_number    VARCHAR(32)  NOT NULL,
    name              VARCHAR(255) NOT NULL,
    status            VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DRAFT')),
    parent_version_id VARCHAR(64)  REFERENCES timetable_versions(id) ON DELETE SET NULL,
    disruption_id     VARCHAR(64)  REFERENCES disruptions(id) ON DELETE SET NULL,
    approved_by       VARCHAR(128) NOT NULL,
    change_log        TEXT,
    quality_score     NUMERIC(6, 2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- At most one version can be ACTIVE at any time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_version
    ON timetable_versions (status) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS timetable_entries (
    id           VARCHAR(64) PRIMARY KEY,
    version_id   VARCHAR(64) NOT NULL REFERENCES timetable_versions(id) ON DELETE CASCADE,
    section_id   VARCHAR(64) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id   VARCHAR(64) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    faculty_id   VARCHAR(64) NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    room_id      VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    day_of_week  VARCHAR(16) NOT NULL
                 CHECK (day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')),
    slot_id      VARCHAR(8)  NOT NULL CHECK (slot_id IN ('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7')),
    session_type VARCHAR(32) NOT NULL DEFAULT 'LECTURE',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- A room, a faculty member and a section can each be used once per slot.
    CONSTRAINT uq_room_day_slot_version    UNIQUE (version_id, room_id, day_of_week, slot_id),
    CONSTRAINT uq_faculty_day_slot_version UNIQUE (version_id, faculty_id, day_of_week, slot_id),
    CONSTRAINT uq_section_day_slot_version UNIQUE (version_id, section_id, day_of_week, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_section_day ON timetable_entries (version_id, section_id, day_of_week);

CREATE TABLE IF NOT EXISTS notifications (
    id           VARCHAR(64)  PRIMARY KEY,
    user_id      VARCHAR(64)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         VARCHAR(32)  NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    old_slot     VARCHAR(64),
    new_slot     VARCHAR(64),
    day_of_week  VARCHAR(32),
    message      TEXT         NOT NULL,
    status       VARCHAR(16)  NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications (user_id, status);

CREATE TABLE IF NOT EXISTS google_calendar_connections (
    user_id              VARCHAR(64)  PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    google_account_email VARCHAR(255),
    auth_status          VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE'
                         CHECK (auth_status IN ('ACTIVE', 'REAUTH_REQUIRED', 'DISCONNECTED')),
    token_expires_at     TIMESTAMPTZ,
    can_refresh_token    BOOLEAN      NOT NULL DEFAULT FALSE,
    last_synced_at       TIMESTAMPTZ,
    events_count         INT          NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
