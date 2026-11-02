--
-- PostgreSQL database dump
--

\restrict O8gUIXigxLt9X3ar1oyko8Vtt0OmjpaZuGL2gVAFbKXMeWpALgV6Yns9CLzVpB6

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: BlockKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BlockKind" AS ENUM (
    'LUNCH',
    'MENTORING',
    'MINOR',
    'INDUSTRY_EXPERT',
    'OTHER'
);


--
-- Name: CalendarAuthStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CalendarAuthStatus" AS ENUM (
    'ACTIVE',
    'REAUTH_REQUIRED',
    'DISCONNECTED'
);


--
-- Name: DayOfWeek; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DayOfWeek" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY'
);


--
-- Name: DisruptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DisruptionStatus" AS ENUM (
    'RECORDED',
    'ANALYZED',
    'RESOLVED',
    'DISMISSED'
);


--
-- Name: NotificationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationStatus" AS ENUM (
    'UNREAD',
    'READ'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'COORDINATOR',
    'FACULTY',
    'STUDENT'
);


--
-- Name: RoomType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RoomType" AS ENUM (
    'CLASSROOM',
    'LAB',
    'SEMINAR_HALL'
);


--
-- Name: SessionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SessionType" AS ENUM (
    'LECTURE',
    'LAB',
    'TUTORIAL',
    'PROJECT'
);


--
-- Name: SubjectType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubjectType" AS ENUM (
    'LECTURE',
    'LAB',
    'TUTORIAL'
);


--
-- Name: VersionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VersionStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED',
    'DRAFT'
);


--
-- Name: set_entry_room_exclusive(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_entry_room_exclusive() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."room_exclusive" := NOT COALESCE((SELECT "is_shared" FROM "rooms" WHERE "id" = NEW."room_id"), FALSE);
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: approval_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_logs (
    id character varying(64) NOT NULL,
    disruption_id character varying(64) NOT NULL,
    alternative_id character varying(64) NOT NULL,
    approved_version_id character varying(64) NOT NULL,
    approved_by character varying(128) NOT NULL,
    notes text,
    approved_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: disruptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disruptions (
    id character varying(64) NOT NULL,
    disruption_type character varying(64) NOT NULL,
    affected_entity_type character varying(64) NOT NULL,
    affected_entity_id character varying(64) NOT NULL,
    affected_entity_name character varying(128),
    day_of_week character varying(32) NOT NULL,
    date character varying(16),
    slot_id character varying(8),
    reason text,
    reported_by character varying(128),
    status public."DisruptionStatus" DEFAULT 'RECORDED'::public."DisruptionStatus" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at timestamp(6) with time zone
);


--
-- Name: faculty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculty (
    id character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    email character varying(255) NOT NULL,
    department character varying(128) NOT NULL,
    max_hours_per_week integer DEFAULT 18 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: google_calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_connections (
    user_id character varying(64) NOT NULL,
    google_account_email character varying(255),
    auth_status public."CalendarAuthStatus" DEFAULT 'ACTIVE'::public."CalendarAuthStatus" NOT NULL,
    token_expires_at timestamp(6) with time zone,
    can_refresh_token boolean DEFAULT false NOT NULL,
    last_synced_at timestamp(6) with time zone,
    events_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    access_token_enc text,
    refresh_token_enc text,
    synced_event_ids text[] DEFAULT ARRAY[]::text[]
);


--
-- Name: import_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_batches (
    id character varying(64) NOT NULL,
    source_file character varying(255) NOT NULL,
    source_hash character varying(64) NOT NULL,
    version_id character varying(64),
    summary jsonb NOT NULL,
    issues jsonb NOT NULL,
    imported_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempts (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    attempted_at timestamp(6) with time zone NOT NULL
);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_attempts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id character varying(64) NOT NULL,
    user_id character varying(64) NOT NULL,
    role character varying(32) NOT NULL,
    subject_name character varying(255) NOT NULL,
    old_slot character varying(64),
    new_slot character varying(64),
    day_of_week character varying(32),
    message text NOT NULL,
    status public."NotificationStatus" DEFAULT 'UNREAD'::public."NotificationStatus" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read_at timestamp(6) with time zone
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    building character varying(128) NOT NULL,
    capacity integer NOT NULL,
    type public."RoomType" NOT NULL,
    is_shared boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: section_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_blocks (
    id character varying(64) NOT NULL,
    section_id character varying(64) NOT NULL,
    day_of_week public."DayOfWeek" NOT NULL,
    slot_id character varying(8) NOT NULL,
    kind public."BlockKind" NOT NULL,
    label character varying(255) NOT NULL
);


--
-- Name: sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections (
    id character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    program character varying(128) NOT NULL,
    semester integer NOT NULL,
    student_count integer NOT NULL,
    batch integer,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id character varying(64) NOT NULL,
    code character varying(32) NOT NULL,
    name character varying(255) NOT NULL,
    abbreviation character varying(32),
    department character varying(128),
    type public."SubjectType" NOT NULL,
    category character varying(64),
    ldp character varying(16),
    required_hours_per_week integer DEFAULT 3 NOT NULL,
    credits integer DEFAULT 3 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: time_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_slots (
    id character varying(8) NOT NULL,
    slot_number integer NOT NULL,
    start_time character varying(5) NOT NULL,
    end_time character varying(5) NOT NULL,
    label character varying(32) NOT NULL
);


--
-- Name: timetable_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timetable_entries (
    id character varying(64) NOT NULL,
    version_id character varying(64) NOT NULL,
    section_id character varying(64) NOT NULL,
    co_section_ids character varying(64)[] DEFAULT (ARRAY[]::character varying[])::character varying(64)[],
    subject_id character varying(64) NOT NULL,
    faculty_id character varying(64) NOT NULL,
    room_id character varying(64) NOT NULL,
    day_of_week public."DayOfWeek" NOT NULL,
    slot_id character varying(8) NOT NULL,
    session_type public."SessionType" DEFAULT 'LECTURE'::public."SessionType" NOT NULL,
    is_elective boolean DEFAULT false NOT NULL,
    room_exclusive boolean DEFAULT true NOT NULL,
    source_cell text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: timetable_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timetable_versions (
    id character varying(64) NOT NULL,
    version_number character varying(32) NOT NULL,
    name character varying(255) NOT NULL,
    status public."VersionStatus" DEFAULT 'ACTIVE'::public."VersionStatus" NOT NULL,
    parent_version_id character varying(64),
    disruption_id character varying(64),
    approved_by character varying(128) NOT NULL,
    change_log text,
    quality_score numeric(6,2) DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_electives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_electives (
    user_id character varying(64) NOT NULL,
    subject_id character varying(64) NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public."Role" NOT NULL,
    department character varying(128),
    section_id character varying(64),
    faculty_id character varying(64),
    is_active boolean DEFAULT true NOT NULL,
    token_version integer DEFAULT 0 NOT NULL,
    last_login_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: login_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
f613ef68-5125-42d2-877b-d13356f85eb1	e7c229e8b9d912c19d0276454bf29a4c2bf09889afc7c31237735b1e5e1ec786	2026-11-01 18:46:14.644218+00	20261101174859_init	\N	\N	2026-11-01 18:46:14.458626+00	1
d526fb62-c3b1-4c6d-b92f-7103e1f6ff54	d5dcbd0433f1f4ffc1754adea83a99798d1794cdda907e00e126aff37474ffb3	2026-11-01 18:46:14.668408+00	20261101180226_restrict_entry_deletes	\N	\N	2026-11-01 18:46:14.647178+00	1
ae3c0591-8665-4192-b6f4-652e22bf13f1	2c36aa39a707a7ec6edfedde838478d359b4a328cd67baad87264d611567d161	2026-11-01 18:46:14.682599+00	20261101183107_import_hash_index_not_unique	\N	\N	2026-11-01 18:46:14.671392+00	1
60c4167b-cf55-444b-9221-f9cf8f95a245	a08ad64ef937cee62c9d6dc644d176e57dfb56b37ed12bbd0c280e495831ab2a	2026-11-01 18:55:04.402954+00	20261101185504_google_calendar_tokens	\N	\N	2026-11-01 18:55:04.249891+00	1
6e9b5358-a062-4e4d-965a-cfe189555117	ab5b94d61925f084c33eb041db8eabacfb79321e129311008f9ba4c7f890341a	2026-11-01 21:04:31.125955+00	20261101210431_calendar_sync_ids_and_electives	\N	\N	2026-11-01 21:04:31.098741+00	1
\.


--
-- Data for Name: approval_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.approval_logs (id, disruption_id, alternative_id, approved_version_id, approved_by, notes, approved_at) FROM stdin;
\.


--
-- Data for Name: disruptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.disruptions (id, disruption_type, affected_entity_type, affected_entity_id, affected_entity_name, day_of_week, date, slot_id, reason, reported_by, status, created_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: faculty; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.faculty (id, name, email, department, max_hours_per_week, is_active, created_at) FROM stdin;
F_AVIJIT_CHAKRABORTY	Avijit Chakraborty	avijit.chakraborty@faculty.timora.invalid	I&E	18	t	2026-11-01 18:46:16.673+00
F_ABHIMANYU_SINGH_RANA	Dr. Abhimanyu Singh Rana	abhimanyu.singh.rana@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.677+00
F_ARUN_GUPTA	Dr. Arun Gupta	arun.gupta@faculty.timora.invalid	I&E	18	t	2026-11-01 18:46:16.681+00
F_HARSH_TANEJA	Dr. Harsh Taneja	harsh.taneja@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.684+00
F_ROJO	Dr. Rojo	rojo@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.687+00
F_ABHINAV_CHATURVEDI	Dr. Abhinav Chaturvedi	abhinav.chaturvedi@faculty.timora.invalid	I&E	18	t	2026-11-01 18:46:16.691+00
F_ABHISHEK_JAIN	Dr. Abhishek Jain	abhishek.jain@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.695+00
F_AJAY_SOOD	Dr. Ajay Sood	ajay.sood@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.698+00
F_AKRITI_CHANDRA	Dr. Akriti chandra	akriti.chandra@faculty.timora.invalid	I&E	18	t	2026-11-01 18:46:16.701+00
F_AMIYA_DASH	Dr. Amiya Dash	amiya.dash@faculty.timora.invalid	I&E	18	t	2026-11-01 18:46:16.704+00
F_ANUBHAV_AGRAWAL	Dr. Anubhav Agrawal	anubhav.agrawal@faculty.timora.invalid	ECE	18	t	2026-11-01 18:46:16.706+00
F_ANUSHA_CHHABRA	Dr. Anusha Chhabra	anusha.chhabra@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.709+00
F_ARADHANA_NARANG	Dr. Aradhana Narang	aradhana.narang@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.712+00
F_ARIJIT_MAITRA	Dr. Arijit Maitra	arijit.maitra@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.715+00
F_ARUN_PUNIA	Dr. Arun Punia	arun.punia@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.718+00
F_ASHOK_SUHAG	Dr. Ashok Suhag	ashok.suhag@faculty.timora.invalid	ECE	18	t	2026-11-01 18:46:16.72+00
F_ATUL_MISHRA	Dr. Atul Mishra	atul.mishra@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.722+00
F_CHHAYABRITA_MAJI	Dr. Chhayabrita Maji	chhayabrita.maji@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.724+00
F_DEEPAK_KUMAR	Dr. Deepak Kumar	deepak.kumar@faculty.timora.invalid	IQAC	18	t	2026-11-01 18:46:16.726+00
F_DEVANJALI_RELAN	Dr. Devanjali Relan	devanjali.relan@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.729+00
F_HIMANSHU_UPRETI	Dr. Himanshu Upreti	himanshu.upreti@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.731+00
F_HIRDESH_KUMAR_PHARASI	Dr. Hirdesh Kumar Pharasi	hirdesh.kumar.pharasi@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.734+00
F_ISHA_GANGULY	Dr. Isha Ganguly	isha.ganguly@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.737+00
F_KIRAN_KHATTER	Dr. Kiran Khatter	kiran.khatter@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.74+00
F_KIRAN_SHARMA	Dr. Kiran Sharma	kiran.sharma@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.743+00
F_KULVIR_LAMBA	Dr. Kulvir Lamba	kulvir.lamba@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.746+00
F_LUCKSHAY_BATRA	Dr. Luckshay Batra	luckshay.batra@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.75+00
F_MADHULIKA_SAXENA	Dr. Madhulika Saxena	madhulika.saxena@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.754+00
F_MANISHA_SAINI	Dr. Manisha Saini	manisha.saini@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.757+00
F_MEENAKSHI_MALIK	Dr. Meenakshi Malik	meenakshi.malik@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.76+00
F_NC_KAUSHIK	Dr. NC Kaushik	nc.kaushik@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.763+00
F_NEERAJ_SHARMA	Dr. Neeraj Sharma	neeraj.sharma@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.767+00
F_NIKHIL_KUMAR	Dr. Nikhil Kumar	nikhil.kumar@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.77+00
F_NIRPAMA_MP	Dr. Nirpama MP	nirpama.mp@faculty.timora.invalid	I&E	18	t	2026-11-01 18:46:16.772+00
F_NISHTHA_PHUTELA	Dr. Nishtha Phutela	nishtha.phutela@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.775+00
F_PALAK_GOEL	Dr. palak Goel	palak.goel@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.779+00
F_PARMOD_KUMAR	Dr. Parmod Kumar	parmod.kumar@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.782+00
F_PRANSHU_TIWARI	Dr. Pranshu Tiwari	pranshu.tiwari@faculty.timora.invalid	VF	18	t	2026-11-01 18:46:16.785+00
F_RANBIR_SINGH	Dr. Ranbir Singh	ranbir.singh@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.788+00
F_RANJIB_BANERJEE	Dr. Ranjib Banerjee	ranjib.banerjee@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.793+00
F_RISHI_ASTHANA	Dr. Rishi Asthana	rishi.asthana@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.796+00
F_SAMBHUNATH_BERA	Dr. Sambhunath Bera	sambhunath.bera@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.8+00
F_SANDEEP_KUMAR	Dr. Sandeep Kumar	sandeep.kumar@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.803+00
F_SANMITRA_BARMAN	Dr. Sanmitra Barman	sanmitra.barman@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.807+00
F_SATPAL	Dr. Satpal	satpal@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.81+00
F_SATYENDR_SINGH	Dr. Satyendr Singh	satyendr.singh@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.814+00
F_SAURABH_MISHRA	Dr. Saurabh Mishra	saurabh.mishra@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.819+00
F_SHILPA_MAHAJAN	Dr. Shilpa Mahajan	shilpa.mahajan@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.823+00
F_SOHARAB_HOSSAIN	Dr. Soharab Hossain	soharab.hossain@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.827+00
F_SONU_RATHI	Dr. Sonu Rathi	sonu.rathi@faculty.timora.invalid	ECOMP	18	t	2026-11-01 18:46:16.83+00
F_SRIKANTH_K	Dr. Srikanth k	srikanth.k@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.834+00
F_SUCHITRA_CHAUHAN	Dr. Suchitra Chauhan	suchitra.chauhan@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.837+00
F_SUKHANDEEP_KAUR	Dr. Sukhandeep Kaur	sukhandeep.kaur@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.841+00
F_TABISH_RASHEED	Dr. Tabish Rasheed	tabish.rasheed@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.844+00
F_YARRAMENENI_SRIDHAR_BABU	Dr. Yarrameneni Sridhar Babu	yarrameneni.sridhar.babu@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.848+00
F_YOGESH_GUPTA	Dr. Yogesh Gupta	yogesh.gupta@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.851+00
F_ZIYA_UDDIN	Dr. Ziya Uddin	ziya.uddin@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.855+00
F_DEEPAK_PANDIT	Dr. Deepak Pandit	deepak.pandit@faculty.timora.invalid	I&E	18	t	2026-11-01 18:46:16.858+00
F_VISHAL_BALORIA	Dr. Vishal Baloria	vishal.baloria@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.861+00
F_JYOTI_PRAKASH	Mr. Jyoti Prakash	jyoti.prakash@faculty.timora.invalid	VF	18	t	2026-11-01 18:46:16.864+00
F_ABHISHEK_CHAUHAN	Mr. Abhishek Chauhan	abhishek.chauhan@faculty.timora.invalid	CODING BLOCK	18	t	2026-11-01 18:46:16.867+00
F_ASIF_IQBAL	Mr. Asif Iqbal	asif.iqbal@faculty.timora.invalid	ECOMP	18	t	2026-11-01 18:46:16.871+00
F_BEENU_TANEJA	Mr. Beenu Taneja	beenu.taneja@faculty.timora.invalid	vf	18	t	2026-11-01 18:46:16.873+00
F_GAUTAM	Mr. Gautam	gautam@faculty.timora.invalid	vf	18	t	2026-11-01 18:46:16.877+00
F_MAINPAL_SINGH	Mr. Mainpal Singh	mainpal.singh@faculty.timora.invalid	AS	18	t	2026-11-01 18:46:16.879+00
F_NAMAN_JAIN	Mr. Naman Jain	naman.jain@faculty.timora.invalid	CODING BLOCK	18	t	2026-11-01 18:46:16.883+00
F_NAVYUM	Mr. Navyum	navyum@faculty.timora.invalid	CODING BLOCK	18	t	2026-11-01 18:46:16.885+00
F_SACHIN_WARIYAL	Mr. Sachin Wariyal	sachin.wariyal@faculty.timora.invalid	CODING BLOCK	18	t	2026-11-01 18:46:16.889+00
F_SHUBHAM_SINGHAL	Mr. Shubham Singhal	shubham.singhal@faculty.timora.invalid	CODING BLOCK	18	t	2026-11-01 18:46:16.892+00
F_SUDESH	Mr. Sudesh	sudesh@faculty.timora.invalid	VF	18	t	2026-11-01 18:46:16.895+00
F_DIVYA_SHARMA	Ms. Divya Sharma	divya.sharma@faculty.timora.invalid	VF	18	t	2026-11-01 18:46:16.898+00
F_MONIKA_MOKAN	Dr. Monika Mokan	monika.mokan@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.901+00
F_POOJA_CHOUDHARY	Ms. Pooja Choudhary	pooja.choudhary@faculty.timora.invalid	ECOMP	18	t	2026-11-01 18:46:16.904+00
F_AJAY_MOHAN_GOYAL	Prof. Ajay Mohan Goyal	ajay.mohan.goyal@faculty.timora.invalid	VF	18	t	2026-11-01 18:46:16.907+00
F_ANANTHA_RAO	Prof. Anantha Rao	anantha.rao@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.911+00
F_NANDITA_CHOUDHURY	Prof. Nandita Choudhury	nandita.choudhury@faculty.timora.invalid	LLA	18	t	2026-11-01 18:46:16.914+00
F_SUSHIL_CHANDRA	Prof. Sushil Chandra	sushil.chandra@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.917+00
F_ADITI_VARMANI	Dr. Aditi Varmani	aditi.varmani@faculty.timora.invalid	LLA	18	t	2026-11-01 18:46:16.92+00
F_SUMIT_BADOTRA	Dr. Sumit Badotra	sumit.badotra@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.923+00
F_NIDHI_SHARMA	Ms. Nidhi Sharma	nidhi.sharma@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.926+00
F_SHRADDHA_ARORA	Dr. Shraddha Arora	shraddha.arora@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.929+00
F_VISITING_FACULTY	Visiting Faculty	visiting.faculty@faculty.timora.invalid	Visiting	18	t	2026-11-01 18:46:16.932+00
F_TANVI_JAIN	Dr. Tanvi Jain	tanvi.jain@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.935+00
F_SUBHANKAR_GHATAK	Dr. Subhankar Ghatak	subhankar.ghatak@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.938+00
F_ADITI_PALIT	Dr. Aditi Palit	aditi.palit@faculty.timora.invalid	CSE	18	t	2026-11-01 18:46:16.941+00
F_N_C_KAUSHIK	Dr. N C Kaushik	n.c.kaushik@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.944+00
F_ANUBHAV_AGARWAL	Dr. Anubhav Agarwal	anubhav.agarwal@faculty.timora.invalid	ME	18	t	2026-11-01 18:46:16.947+00
F_SIDDHARTH_VASHIST	Dr. Siddharth Vashist	siddharth.vashist@faculty.timora.invalid	Minor Programme	18	t	2026-11-01 18:46:16.951+00
\.


--
-- Data for Name: google_calendar_connections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.google_calendar_connections (user_id, google_account_email, auth_status, token_expires_at, can_refresh_token, last_synced_at, events_count, created_at, access_token_enc, refresh_token_enc, synced_event_ids) FROM stdin;
\.


--
-- Data for Name: import_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.import_batches (id, source_file, source_hash, version_id, summary, issues, imported_at) FROM stdin;
IMP_40d5fb1f-b474-48c6-ba3e-189f056fb102	2024 Batch V wef 24th Aug 26. Ver III.xlsx	6d1375bbde96e5a4e8014b9ecff8dc30746698a2bf44e8a0b9083f25269c969e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	{"rooms": 26, "blocks": 120, "sheets": 10, "classes": 253, "faculty": 88, "skipped": 1, "subjects": 27, "cellsRead": 396, "combinedClasses": 40}	[{"cell": "G3", "text": "BEVT/D&CS WORKSHOP", "sheet": "24-ME", "message": "Room for \\"BEVT\\" taken from the same cell: Workshop.", "severity": "info"}, {"cell": "H3", "text": "BEVT/D&CS WORKSHOP", "sheet": "24-ME", "message": "Room for \\"BEVT\\" taken from the same cell: Workshop.", "severity": "info"}, {"cell": "C6", "text": "24-CSE III!C6: PRJ 1 NB 307", "sheet": "24-CSE III", "message": "Room NB307 is double-booked on FRIDAY S2: PRJ3908 clashes with CSE3722. Class skipped.", "severity": "conflict"}]	2026-11-01 18:46:17.281+00
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_attempts (id, email, attempted_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, role, subject_name, old_slot, new_slot, day_of_week, message, status, created_at, read_at) FROM stdin;
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rooms (id, name, building, capacity, type, is_shared, is_active, created_at) FROM stdin;
R_NB307	NB307	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:16.954+00
R_NB209	NB209	NB Block	70	LAB	f	t	2026-11-01 18:46:16.958+00
R_NB309	NB309	NB Block	70	LAB	f	t	2026-11-01 18:46:16.962+00
R_NB311	NB311	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:16.966+00
R_NB312	NB312	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:16.971+00
R_GA101	GA101	Gateway Building	70	LAB	f	t	2026-11-01 18:46:16.977+00
R_GA202B	GA202B	Gateway Building	70	LAB	f	t	2026-11-01 18:46:16.984+00
R_NB313	NB313	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:16.989+00
R_NB314	NB314	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:16.994+00
R_NB208	NB208	E2 Building	70	LAB	f	t	2026-11-01 18:46:16.998+00
R_NB102	NB102	NB Block	70	LAB	f	t	2026-11-01 18:46:17.002+00
R_MECHATRONICS_LAB_WORKSHOP_AREA	Mechatronics Lab (Workshop Area)	Workshop	70	LAB	t	t	2026-11-01 18:46:17.006+00
R_NB315	NB315	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:17.009+00
R_GA102	GA102	Gateway Building	70	LAB	f	t	2026-11-01 18:46:17.012+00
R_NB214	NB214	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:17.016+00
R_NB215	NB215	NB Block	70	CLASSROOM	f	t	2026-11-01 18:46:17.018+00
R_GA102B	GA102B	Gateway Building	70	LAB	f	t	2026-11-01 18:46:17.021+00
R_WORKSHOP	Workshop	Workshop	70	LAB	t	t	2026-11-01 18:46:17.024+00
R_GA205	GA205	Gateway Building	70	CLASSROOM	f	t	2026-11-01 18:46:17.027+00
R_GA204	GA204	Gateway Building	70	CLASSROOM	f	t	2026-11-01 18:46:17.03+00
R_AUTOMATION_LAB_WORKSHOP_AREA	Automation Lab (Workshop Area)	Workshop	70	LAB	t	t	2026-11-01 18:46:17.033+00
R_GA102A	GA102A	Gateway Building	70	LAB	f	t	2026-11-01 18:46:17.036+00
R_NB103	NB103	NB Block	70	LAB	f	t	2026-11-01 18:46:17.038+00
R_GA202A	GA202A	Gateway Building	70	LAB	f	t	2026-11-01 18:46:17.042+00
R_GA301A	GA301A	Gateway Building	70	LAB	f	t	2026-11-01 18:46:17.045+00
R_GA301B	GA301B	Gateway Building	70	LAB	f	t	2026-11-01 18:46:17.048+00
\.


--
-- Data for Name: section_blocks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.section_blocks (id, section_id, day_of_week, slot_id, kind, label) FROM stdin;
BLK_2024_CSE_I_MON_S4_LUNCH	2024_CSE_I	MONDAY	S4	LUNCH	Lunch
BLK_2024_CSE_I_TUE_S4_LUNCH	2024_CSE_I	TUESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_I_WED_S6_LUNCH	2024_CSE_I	WEDNESDAY	S6	LUNCH	Lunch
BLK_2024_CSE_I_WED_S7_MENTORING	2024_CSE_I	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_I_WED_S8_MENTORING	2024_CSE_I	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_I_WED_S9_MENTORING	2024_CSE_I	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_I_THU_S4_LUNCH	2024_CSE_I	THURSDAY	S4	LUNCH	Lunch
BLK_2024_CSE_I_THU_S7_MINOR	2024_CSE_I	THURSDAY	S7	MINOR	Minor
BLK_2024_CSE_I_THU_S8_MINOR	2024_CSE_I	THURSDAY	S8	MINOR	Minor
BLK_2024_CSE_I_FRI_S4_LUNCH	2024_CSE_I	FRIDAY	S4	LUNCH	Lunch
BLK_2024_CSE_I_FRI_S8_INDUSTRY_EXPERT	2024_CSE_I	FRIDAY	S8	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_I_FRI_S9_INDUSTRY_EXPERT	2024_CSE_I	FRIDAY	S9	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_II_MON_S4_LUNCH	2024_CSE_II	MONDAY	S4	LUNCH	Lunch
BLK_2024_CSE_II_TUE_S4_LUNCH	2024_CSE_II	TUESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_II_WED_S1_MINOR	2024_CSE_II	WEDNESDAY	S1	MINOR	Minor
BLK_2024_CSE_II_WED_S4_LUNCH	2024_CSE_II	WEDNESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_II_WED_S7_MENTORING	2024_CSE_II	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_II_WED_S8_MENTORING	2024_CSE_II	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_II_WED_S9_MENTORING	2024_CSE_II	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_II_THU_S4_LUNCH	2024_CSE_II	THURSDAY	S4	LUNCH	Lunch
BLK_2024_CSE_II_FRI_S4_LUNCH	2024_CSE_II	FRIDAY	S4	LUNCH	Lunch
BLK_2024_CSE_II_FRI_S8_INDUSTRY_EXPERT	2024_CSE_II	FRIDAY	S8	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_II_FRI_S9_INDUSTRY_EXPERT	2024_CSE_II	FRIDAY	S9	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_III_MON_S4_LUNCH	2024_CSE_III	MONDAY	S4	LUNCH	Lunch
BLK_2024_CSE_III_TUE_S4_LUNCH	2024_CSE_III	TUESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_III_WED_S1_MINOR	2024_CSE_III	WEDNESDAY	S1	MINOR	Minor Thesis NB 314/NVF NB201
BLK_2024_CSE_III_WED_S4_LUNCH	2024_CSE_III	WEDNESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_III_WED_S7_MENTORING	2024_CSE_III	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_III_WED_S8_MENTORING	2024_CSE_III	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_III_WED_S9_MENTORING	2024_CSE_III	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_III_THU_S4_LUNCH	2024_CSE_III	THURSDAY	S4	LUNCH	Lunch
BLK_2024_CSE_III_THU_S7_MINOR	2024_CSE_III	THURSDAY	S7	MINOR	Minor Thesis NB 314/NVF NB201
BLK_2024_CSE_III_THU_S8_MINOR	2024_CSE_III	THURSDAY	S8	MINOR	Minor Thesis NB 314/NVF NB201
BLK_2024_CSE_III_FRI_S4_LUNCH	2024_CSE_III	FRIDAY	S4	LUNCH	Lunch
BLK_2024_CSE_IV_MON_S4_LUNCH	2024_CSE_IV	MONDAY	S4	LUNCH	Lunch
BLK_2024_CSE_IV_TUE_S4_LUNCH	2024_CSE_IV	TUESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_IV_WED_S1_MINOR	2024_CSE_IV	WEDNESDAY	S1	MINOR	Minor Thesis NB 312/NVF NB201
BLK_2024_CSE_IV_WED_S4_LUNCH	2024_CSE_IV	WEDNESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_IV_WED_S7_MENTORING	2024_CSE_IV	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_IV_WED_S8_MENTORING	2024_CSE_IV	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_IV_WED_S9_MENTORING	2024_CSE_IV	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_IV_THU_S4_LUNCH	2024_CSE_IV	THURSDAY	S4	LUNCH	Lunch
BLK_2024_CSE_IV_THU_S7_MINOR	2024_CSE_IV	THURSDAY	S7	MINOR	Minor Thesis NB 314/NVF NB201
BLK_2024_CSE_IV_THU_S8_MINOR	2024_CSE_IV	THURSDAY	S8	MINOR	Minor Thesis NB 314/NVF NB201
BLK_2024_CSE_IV_FRI_S4_LUNCH	2024_CSE_IV	FRIDAY	S4	LUNCH	Lunch
BLK_2024_CSE_IV_FRI_S8_INDUSTRY_EXPERT	2024_CSE_IV	FRIDAY	S8	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_IV_FRI_S9_INDUSTRY_EXPERT	2024_CSE_IV	FRIDAY	S9	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_V_MON_S6_LUNCH	2024_CSE_V	MONDAY	S6	LUNCH	Lunch
BLK_2024_CSE_V_TUE_S4_LUNCH	2024_CSE_V	TUESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_V_WED_S1_MINOR	2024_CSE_V	WEDNESDAY	S1	MINOR	Minor Thesis NB 312/NVF NB201
BLK_2024_CSE_V_WED_S6_LUNCH	2024_CSE_V	WEDNESDAY	S6	LUNCH	Lunch
BLK_2024_CSE_V_WED_S7_MENTORING	2024_CSE_V	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_V_WED_S8_MENTORING	2024_CSE_V	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_V_WED_S9_MENTORING	2024_CSE_V	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_V_THU_S6_LUNCH	2024_CSE_V	THURSDAY	S6	LUNCH	Lunch
BLK_2024_CSE_V_THU_S7_MINOR	2024_CSE_V	THURSDAY	S7	MINOR	Minor Thesis NB 314/NVF NB201
BLK_2024_CSE_V_THU_S8_MINOR	2024_CSE_V	THURSDAY	S8	MINOR	Minor Thesis NB 314/NVF NB201
BLK_2024_CSE_V_FRI_S5_LUNCH	2024_CSE_V	FRIDAY	S5	LUNCH	Lunch
BLK_2024_CSE_V_FRI_S8_INDUSTRY_EXPERT	2024_CSE_V	FRIDAY	S8	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_V_FRI_S9_INDUSTRY_EXPERT	2024_CSE_V	FRIDAY	S9	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_VI_MON_S4_LUNCH	2024_CSE_VI	MONDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VI_TUE_S5_LUNCH	2024_CSE_VI	TUESDAY	S5	LUNCH	Lunch
BLK_2024_CSE_VI_WED_S1_MINOR	2024_CSE_VI	WEDNESDAY	S1	MINOR	Minor
BLK_2024_CSE_VI_WED_S4_LUNCH	2024_CSE_VI	WEDNESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VI_WED_S7_MENTORING	2024_CSE_VI	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VI_WED_S8_MENTORING	2024_CSE_VI	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VI_WED_S9_MENTORING	2024_CSE_VI	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VI_THU_S4_LUNCH	2024_CSE_VI	THURSDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VI_THU_S7_MINOR	2024_CSE_VI	THURSDAY	S7	MINOR	Minor
BLK_2024_CSE_VI_THU_S8_MINOR	2024_CSE_VI	THURSDAY	S8	MINOR	Minor
BLK_2024_CSE_VI_FRI_S5_LUNCH	2024_CSE_VI	FRIDAY	S5	LUNCH	Lunch
BLK_2024_CSE_VI_FRI_S8_INDUSTRY_EXPERT	2024_CSE_VI	FRIDAY	S8	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_VI_FRI_S9_INDUSTRY_EXPERT	2024_CSE_VI	FRIDAY	S9	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_VII_MON_S4_LUNCH	2024_CSE_VII	MONDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VII_TUE_S4_LUNCH	2024_CSE_VII	TUESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VII_WED_S1_MINOR	2024_CSE_VII	WEDNESDAY	S1	MINOR	Minor
BLK_2024_CSE_VII_WED_S6_LUNCH	2024_CSE_VII	WEDNESDAY	S6	LUNCH	Lunch
BLK_2024_CSE_VII_WED_S7_MENTORING	2024_CSE_VII	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VII_WED_S8_MENTORING	2024_CSE_VII	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VII_WED_S9_MENTORING	2024_CSE_VII	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VII_THU_S4_LUNCH	2024_CSE_VII	THURSDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VII_THU_S7_MINOR	2024_CSE_VII	THURSDAY	S7	MINOR	Minor
BLK_2024_CSE_VII_THU_S8_MINOR	2024_CSE_VII	THURSDAY	S8	MINOR	Minor
BLK_2024_CSE_VII_FRI_S4_LUNCH	2024_CSE_VII	FRIDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VII_FRI_S8_INDUSTRY_EXPERT	2024_CSE_VII	FRIDAY	S8	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_VII_FRI_S9_INDUSTRY_EXPERT	2024_CSE_VII	FRIDAY	S9	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_VIII_MON_S4_LUNCH	2024_CSE_VIII	MONDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VIII_TUE_S5_LUNCH	2024_CSE_VIII	TUESDAY	S5	LUNCH	Lunch
BLK_2024_CSE_VIII_WED_S4_LUNCH	2024_CSE_VIII	WEDNESDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VIII_WED_S7_MENTORING	2024_CSE_VIII	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VIII_WED_S8_MENTORING	2024_CSE_VIII	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VIII_WED_S9_MENTORING	2024_CSE_VIII	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_CSE_VIII_THU_S4_LUNCH	2024_CSE_VIII	THURSDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VIII_THU_S7_MINOR	2024_CSE_VIII	THURSDAY	S7	MINOR	Minor
BLK_2024_CSE_VIII_THU_S8_MINOR	2024_CSE_VIII	THURSDAY	S8	MINOR	Minor
BLK_2024_CSE_VIII_FRI_S4_LUNCH	2024_CSE_VIII	FRIDAY	S4	LUNCH	Lunch
BLK_2024_CSE_VIII_FRI_S8_INDUSTRY_EXPERT	2024_CSE_VIII	FRIDAY	S8	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_CSE_VIII_FRI_S9_INDUSTRY_EXPERT	2024_CSE_VIII	FRIDAY	S9	INDUSTRY_EXPERT	Industry expert on AD&ST once in month
BLK_2024_ME_MON_S4_LUNCH	2024_ME	MONDAY	S4	LUNCH	Lunch
BLK_2024_ME_TUE_S4_LUNCH	2024_ME	TUESDAY	S4	LUNCH	Lunch
BLK_2024_ME_WED_S1_MINOR	2024_ME	WEDNESDAY	S1	MINOR	Minor
BLK_2024_ME_WED_S5_LUNCH	2024_ME	WEDNESDAY	S5	LUNCH	Lunch
BLK_2024_ME_WED_S7_MENTORING	2024_ME	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_ME_WED_S8_MENTORING	2024_ME	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_ME_WED_S9_MENTORING	2024_ME	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_ME_THU_S4_LUNCH	2024_ME	THURSDAY	S4	LUNCH	Lunch
BLK_2024_ME_THU_S7_MINOR	2024_ME	THURSDAY	S7	MINOR	Minor
BLK_2024_ME_THU_S8_MINOR	2024_ME	THURSDAY	S8	MINOR	Minor
BLK_2024_ME_FRI_S4_LUNCH	2024_ME	FRIDAY	S4	LUNCH	Lunch
BLK_2024_ECOM_MON_S4_LUNCH	2024_ECOM	MONDAY	S4	LUNCH	Lunch
BLK_2024_ECOM_TUE_S6_LUNCH	2024_ECOM	TUESDAY	S6	LUNCH	Lunch
BLK_2024_ECOM_WED_S1_MINOR	2024_ECOM	WEDNESDAY	S1	MINOR	Minor Thesis NB 314/NVF Automation Lab Workshop Area
BLK_2024_ECOM_WED_S4_LUNCH	2024_ECOM	WEDNESDAY	S4	LUNCH	Lunch
BLK_2024_ECOM_WED_S7_MENTORING	2024_ECOM	WEDNESDAY	S7	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_ECOM_WED_S8_MENTORING	2024_ECOM	WEDNESDAY	S8	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_ECOM_WED_S9_MENTORING	2024_ECOM	WEDNESDAY	S9	MENTORING	DSW/ ECC-II/ Mentor meeting
BLK_2024_ECOM_THU_S4_LUNCH	2024_ECOM	THURSDAY	S4	LUNCH	Lunch
BLK_2024_ECOM_THU_S7_MINOR	2024_ECOM	THURSDAY	S7	MINOR	Minor Thesis NB 314/NVF Automation Lab Workshop Area
BLK_2024_ECOM_THU_S8_MINOR	2024_ECOM	THURSDAY	S8	MINOR	Minor Thesis NB 314/NVF Automation Lab Workshop Area
BLK_2024_ECOM_FRI_S4_LUNCH	2024_ECOM	FRIDAY	S4	LUNCH	Lunch
\.


--
-- Data for Name: sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sections (id, name, program, semester, student_count, batch, created_at) FROM stdin;
2024_CSE_I	CSE I	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.639+00
2024_CSE_II	CSE II	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.644+00
2024_CSE_III	CSE III	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.647+00
2024_CSE_IV	CSE IV	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.65+00
2024_CSE_V	CSE V	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.653+00
2024_CSE_VI	CSE VI	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.656+00
2024_CSE_VII	CSE VII	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.659+00
2024_CSE_VIII	CSE VIII	B.Tech CSE	5	60	2024	2026-11-01 18:46:16.663+00
2024_ME	ME	B.Tech ME	5	60	2024	2026-11-01 18:46:16.666+00
2024_ECOM	ECoM	B.Tech ECoM	5	60	2024	2026-11-01 18:46:16.669+00
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subjects (id, code, name, abbreviation, department, type, category, ldp, required_hours_per_week, credits, created_at) FROM stdin;
SUB_ECC3501	ECC3501	Enrichment Credit Course - II	ECC-II	CSE	LECTURE	Co-Curricular	\N	3	3	2026-11-01 18:46:17.05+00
SUB_PRJ3908	PRJ3908	Project – I	PRJ 1	CSE	LECTURE	Core Project	\N	2	2	2026-11-01 18:46:17.054+00
SUB_CSE2032	CSE2032	Machine Learning	ML	CSE	LECTURE	Core	2-0-2	4	3	2026-11-01 18:46:17.058+00
SUB_CSE2709	CSE2709	Computer Organization & Architecture	COA	CSE	LECTURE	Core	2-1-0	3	3	2026-11-01 18:46:17.061+00
SUB_CSE3005	CSE3005	Software Engineering	SE	CSE	LECTURE	Core	2-0-2	4	3	2026-11-01 18:46:17.064+00
SUB_CSE3705	CSE3705	Artificial Intelligence	AI	CSE	LECTURE	Core	3-0-0	3	3	2026-11-01 18:46:17.067+00
SUB_CSE3722	CSE3722	IoT Networks, Architectures and Applications	IoT-NAA	CSE	LECTURE	Core	2-0-2	4	3	2026-11-01 18:46:17.07+00
SUB_SKL3707	SKL3707	Coding Skills	COD SKL	CSE	LECTURE	SEC	\N	3	3	2026-11-01 18:46:17.074+00
SUB_CSE3105	CSE3105	Advanced Data Science	ADS	CSE	LECTURE	Core Elective	2-0-2	4	3	2026-11-01 18:46:17.077+00
SUB_CSE3102	CSE3102	Computational Epidemiology and Digital Health Analytics	CE&DHA	CSE	LECTURE	Core Elective	2-0-2	4	3	2026-11-01 18:46:17.08+00
SUB_CSE3712	CSE3712	Big Data Analytics	BDA	CSE	LECTURE	Core Elective	2-0-2	4	3	2026-11-01 18:46:17.082+00
SUB_CSE4001	CSE4001	Security Attack & Defence	SAD	CSE	LECTURE	Core Elective	3-0-0	3	3	2026-11-01 18:46:17.085+00
SUB_CSE4707	CSE4707	Advanced Data Science	ADS	CSE	LECTURE	Core Elective	2-0-2	4	3	2026-11-01 18:46:17.088+00
SUB_CSE3103	CSE3103	Applied Databases and Systems Thinking	AD&ST	CSE	LECTURE	Core Elective	2-0-2	4	3	2026-11-01 18:46:17.091+00
SUB_MEC3105	MEC3105	Metal Cutting and Forming	MCF	ME	LECTURE	Core	1-0-2	3	2	2026-11-01 18:46:17.094+00
SUB_MEC3715	MEC3715	Quality Control Assurance & Reliability	QCAR	ME	LECTURE	Core	2-0-0	2	2	2026-11-01 18:46:17.096+00
SUB_MEC3101	MEC3101	Kinematic & Dynamics of Machine	KIN & DYN	ME	LECTURE	Core	3-0-2	5	4	2026-11-01 18:46:17.099+00
SUB_MEC3102	MEC3102	IC Engines & Automobile Engineering	IC ENG	ME	LECTURE	Core	2-0-2	4	3	2026-11-01 18:46:17.102+00
SUB_MEC3103	MEC3103	FEA & CFD Lab	FEA & CFD Lab	ME	LAB	SEC	0-0-4	4	2	2026-11-01 18:46:17.105+00
SUB_MEC3104	MEC3104	Drives and Control Systems	D&CS	ME	LECTURE	Core Elective	2-0-2	4	3	2026-11-01 18:46:17.108+00
SUB_MEC4013	MEC4013	Basics of Electric Vehicle Technologies	BEVT	ME	LECTURE	Core Elective	2-0-2	4	3	2026-11-01 18:46:17.112+00
SUB_ECE3101	ECE3101	Microprocessors and Microcontrollers	M&M	ECoM	LECTURE	Core	2-0-2	4	3	2026-11-01 18:46:17.115+00
SUB_ECE3102	ECE3102	Digital VLSI Design	DIG. VLSI	ECoM	LECTURE	Core	2-0-2	4	3	2026-11-01 18:46:17.118+00
SUB_ECE3103	ECE3103	RTL Design using Verilog	RTL	ECoM	LECTURE	VLSI Design	2-0-2	4	3	2026-11-01 18:46:17.121+00
SUB_ECE3007	ECE3007	Control System	CS	ECoM	LECTURE	BASIC ECOM	2-0-2	4	3	2026-11-01 18:46:17.124+00
SUB_PRJ3906	PRJ3906	Minor Program Nanotechnology	Thesis	Minor Programme	LECTURE	Minor Programme	0-1-4	5	3	2026-11-01 18:46:17.128+00
SUB_ENT3002	ENT3002	Minor Program :Entrepreneurship	NVF	Minor Programme	LECTURE	Minor Programme	2-1-0	3	3	2026-11-01 18:46:17.132+00
\.


--
-- Data for Name: time_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.time_slots (id, slot_number, start_time, end_time, label) FROM stdin;
S1	1	09:00	09:55	09:00 - 09:55
S2	2	10:00	10:55	10:00 - 10:55
S3	3	11:00	11:55	11:00 - 11:55
S4	4	12:00	12:55	12:00 - 12:55
S5	5	13:00	13:55	13:00 - 13:55
S6	6	14:00	14:55	14:00 - 14:55
S7	7	15:00	15:55	15:00 - 15:55
S8	8	16:00	16:55	16:00 - 16:55
S9	9	17:00	17:55	17:00 - 17:55
\.


--
-- Data for Name: timetable_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.timetable_entries (id, version_id, section_id, co_section_ids, subject_id, faculty_id, room_id, day_of_week, slot_id, session_type, is_elective, room_exclusive, source_cell, created_at) FROM stdin;
E_6818040e-7fee-4015-b262-4d2d40586bb2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB307	MONDAY	S2	LECTURE	f	t	24-CSE I!C2: ML NB 307	2026-11-01 18:46:17.159+00
E_544bd854-5734-4b8b-b935-9e171bdfb64b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_NB307	MONDAY	S3	LECTURE	f	t	24-CSE I!D2: IoT-NAA NB 307	2026-11-01 18:46:17.159+00
E_e1e2c860-4f47-4340-b1fa-cd25af481132	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB307	MONDAY	S5	LECTURE	f	t	24-CSE I!F2: COD SKL NB 307	2026-11-01 18:46:17.159+00
E_d7cbf9df-9fc5-46fd-ba21-c89af3c7cf2e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB307	MONDAY	S6	LECTURE	f	t	24-CSE I!G2: COD SKL NB 307	2026-11-01 18:46:17.159+00
E_a3a5b475-e995-453c-9b59-285cf33e7b15	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II}	SUB_CSE3105	F_ANANTHA_RAO	R_NB209	MONDAY	S7	LAB	t	t	24-CSE I!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE II!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312	2026-11-01 18:46:17.159+00
E_94bdc397-e766-47d6-9fb0-c7cb63ebd244	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3102	F_DEVANJALI_RELAN	R_NB309	MONDAY	S7	LAB	t	t	24-CSE I!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE II!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE III!H2: CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312	2026-11-01 18:46:17.159+00
E_87128837-4a6f-4d0f-b159-69283396da86	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3712	F_YOGESH_GUPTA	R_NB307	MONDAY	S7	LECTURE	t	t	24-CSE I!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE II!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE III!H2: CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312	2026-11-01 18:46:17.159+00
E_6bdb59f2-7ca7-4deb-b0a5-74d76b9dae27	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII}	SUB_CSE4001	F_ABHISHEK_JAIN	R_NB311	MONDAY	S7	LECTURE	t	t	24-CSE I!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE II!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE III!H2: CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312	2026-11-01 18:46:17.159+00
E_4c15b360-8096-450d-b0a5-3baae8f594fa	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII}	SUB_CSE3103	F_NISHTHA_PHUTELA	R_NB312	MONDAY	S7	LECTURE	t	t	24-CSE I!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE II!H2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312 | 24-CSE III!H2: CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312	2026-11-01 18:46:17.159+00
E_4233019f-109a-4942-9f9d-2affa0080abf	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II}	SUB_CSE3105	F_ANANTHA_RAO	R_NB209	MONDAY	S8	LAB	t	t	24-CSE I!I2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 | 24-CSE II!I2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309	2026-11-01 18:46:17.159+00
E_04343f93-12c4-4a73-8796-dae6c4703b5a	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3102	F_DEVANJALI_RELAN	R_NB309	MONDAY	S8	LAB	t	t	24-CSE I!I2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 | 24-CSE II!I2: ADS CSEI+CSEII LAB NB209 /CE&DHA LAB NB309 | 24-CSE III!I2: CE&DHA LAB NB309	2026-11-01 18:46:17.159+00
E_e5e4bf58-77e9-4587-ad55-7c401fbd0395	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_GA101	TUESDAY	S2	LAB	f	t	24-CSE I!C3: ML LAB GA101	2026-11-01 18:46:17.159+00
E_f2f54fcd-7821-4384-aae8-e994efc2c930	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_GA101	TUESDAY	S3	LAB	f	t	24-CSE I!D3: ML LAB GA101	2026-11-01 18:46:17.159+00
E_db2d96da-351b-4ac7-a5b8-2a1a3f699118	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB307	TUESDAY	S5	LECTURE	f	t	24-CSE I!F3: COA NB 307	2026-11-01 18:46:17.159+00
E_15079a6a-255e-43ad-ac67-f16ca5debdde	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_GA202B	TUESDAY	S6	LAB	f	t	24-CSE I!G3: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_c2d42d1b-f8bd-4505-8891-467619ba6766	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_GA202B	TUESDAY	S7	LAB	f	t	24-CSE I!H3: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_018c26ef-83b9-4612-825c-97b895cd53b9	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB313	TUESDAY	S8	PROJECT	f	t	24-CSE I!I3: PRJ 1 NB313	2026-11-01 18:46:17.159+00
E_ec9d6215-5b69-41a8-8059-cda64d4f71c4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB313	TUESDAY	S9	PROJECT	f	t	24-CSE I!J3: PRJ 1 NB313	2026-11-01 18:46:17.159+00
E_ceb854c3-bcca-43d7-956c-38acee6965e2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB307	WEDNESDAY	S1	LECTURE	f	t	24-CSE I!B4: AI NB 307	2026-11-01 18:46:17.159+00
E_8c0480e8-8711-462f-8c8f-0ebc40a469aa	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II}	SUB_CSE3105	F_ANANTHA_RAO	R_NB313	WEDNESDAY	S2	LECTURE	t	t	24-CSE I!C4: ADS CSEI+CSEII NB 313 CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE II!C4: ADS CSEI+CSEII NB 313 /CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312	2026-11-01 18:46:17.159+00
E_ab21cd9d-3abb-4bbc-96af-637d8368429c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3102	F_TANVI_JAIN	R_NB314	WEDNESDAY	S2	LECTURE	t	t	24-CSE I!C4: ADS CSEI+CSEII NB 313 CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE II!C4: ADS CSEI+CSEII NB 313 /CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE III!C4: CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312	2026-11-01 18:46:17.159+00
E_9451681b-3f75-4ce5-a84f-a239285375f8	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3712	F_YOGESH_GUPTA	R_NB307	WEDNESDAY	S2	LECTURE	t	t	24-CSE I!C4: ADS CSEI+CSEII NB 313 CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE II!C4: ADS CSEI+CSEII NB 313 /CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE III!C4: CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312	2026-11-01 18:46:17.159+00
E_87b40188-2416-4279-b868-1c9570d8faf0	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_NB311	TUESDAY	S3	LECTURE	f	t	24-CSE II!D3: IoT-NAA NB 311	2026-11-01 18:46:17.159+00
E_8fec4330-106d-4f39-8930-d214906d4433	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB311	TUESDAY	S5	PROJECT	f	t	24-CSE II!F3: PRJ 1 NB 311	2026-11-01 18:46:17.159+00
E_ea16f488-0eee-4027-a5b5-9072fff69dd4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII}	SUB_CSE4001	F_ABHISHEK_JAIN	R_NB311	WEDNESDAY	S2	LECTURE	t	t	24-CSE I!C4: ADS CSEI+CSEII NB 313 CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE II!C4: ADS CSEI+CSEII NB 313 /CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE III!C4: CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312	2026-11-01 18:46:17.159+00
E_3fbb7bb7-0a76-43cd-9c1b-80578be07ac6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII}	SUB_CSE3103	F_NISHTHA_PHUTELA	R_NB312	WEDNESDAY	S2	LECTURE	t	t	24-CSE I!C4: ADS CSEI+CSEII NB 313 CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE II!C4: ADS CSEI+CSEII NB 313 /CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312 | 24-CSE III!C4: CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312	2026-11-01 18:46:17.159+00
E_4bfdf11d-8dcb-4c40-9dfc-c2ca73e75c40	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3005	F_NISHTHA_PHUTELA	R_NB208	WEDNESDAY	S3	LAB	f	t	24-CSE I!D4: SE LAB NB208	2026-11-01 18:46:17.159+00
E_900ef567-0161-49ea-93cc-88eb3299934e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3005	F_NISHTHA_PHUTELA	R_NB208	WEDNESDAY	S4	LAB	f	t	24-CSE I!E4: SE LAB NB208	2026-11-01 18:46:17.159+00
E_33adb771-a4f5-4ac2-89b1-36a0f44244bb	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB307	WEDNESDAY	S5	LECTURE	f	t	24-CSE I!F4: COA NB 307	2026-11-01 18:46:17.159+00
E_b87af7d1-de65-46fc-b10c-5ccb701e160f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB307	THURSDAY	S2	LECTURE	f	t	24-CSE I!C5: AI NB 307	2026-11-01 18:46:17.159+00
E_7faf1d85-df73-49b4-a69f-47b8ea500086	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3005	F_NISHTHA_PHUTELA	R_NB307	THURSDAY	S3	LECTURE	f	t	24-CSE I!D5: SE NB 307	2026-11-01 18:46:17.159+00
E_8c3fe9e0-27b2-4035-8964-0dda29563f94	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB307	THURSDAY	S5	LECTURE	f	t	24-CSE I!F5: COA NB 307	2026-11-01 18:46:17.159+00
E_6cc4cdab-82aa-47c9-83e3-26db91a16702	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB307	THURSDAY	S6	LECTURE	f	t	24-CSE I!G5: ML NB 307	2026-11-01 18:46:17.159+00
E_44034e54-e7c5-43bc-b1d2-7505323a6d21	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB307	FRIDAY	S1	LECTURE	f	t	24-CSE I!B6: AI NB 307	2026-11-01 18:46:17.159+00
E_c420c960-1e3b-4da5-9454-9f49c788ed7c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_NB307	FRIDAY	S2	LECTURE	f	t	24-CSE I!C6: IoT-NAA NB307	2026-11-01 18:46:17.159+00
E_1bf7b94a-e8c5-4393-a032-e2bc325085bf	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{}	SUB_CSE3005	F_NISHTHA_PHUTELA	R_NB307	FRIDAY	S3	LECTURE	f	t	24-CSE I!D6: SE NB 307	2026-11-01 18:46:17.159+00
E_50c16820-ace4-4341-92ab-63c186ea9c36	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII}	SUB_CSE3103	F_NISHTHA_PHUTELA	R_NB309	FRIDAY	S6	LAB	t	t	24-CSE I!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD 311 /CE&DHA 314 | 24-CSE II!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD NB311 /CE&DHA NB 314 | 24-CSE III!G6: AD&ST LAB (NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSEIII+CSEIV NB209	2026-11-01 18:46:17.159+00
E_3d6c0f27-674e-4b0f-9f83-34bb96148057	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3712	F_YOGESH_GUPTA	R_NB102	FRIDAY	S6	LAB	t	t	24-CSE I!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD 311 /CE&DHA 314 | 24-CSE II!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD NB311 /CE&DHA NB 314 | 24-CSE III!G6: AD&ST LAB (NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSEIII+CSEIV NB209	2026-11-01 18:46:17.159+00
E_03847489-855d-4e53-8c5f-139d594b765f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII}	SUB_CSE4001	F_ABHISHEK_JAIN	R_NB311	FRIDAY	S6	LECTURE	t	t	24-CSE I!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD 311 /CE&DHA 314 | 24-CSE II!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD NB311 /CE&DHA NB 314 | 24-CSE III!G6: AD&ST LAB (NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSEIII+CSEIV NB209	2026-11-01 18:46:17.159+00
E_fea0e165-c809-451a-a10f-4622989513fb	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3102	F_TANVI_JAIN	R_NB314	FRIDAY	S6	LECTURE	t	t	24-CSE I!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD 311 /CE&DHA 314 | 24-CSE II!G6: AD&ST LAB (NB309) /BDA LAB NB102 /SAD NB311 /CE&DHA NB 314 | 24-CSE III!G6: AD&ST LAB (NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSEIII+CSEIV NB209	2026-11-01 18:46:17.159+00
E_881da695-9339-4cc6-9b1a-a5b207c97e78	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII}	SUB_CSE3103	F_NISHTHA_PHUTELA	R_NB309	FRIDAY	S7	LAB	t	t	24-CSE I!H6: AD&ST LAB (NB309)/ADS CSEI+CSEII NB 313/BDA LAB NB102 | 24-CSE II!H6: AD&ST LAB(NB309) /ADS CSEI+CSEII NB 313/BDA LAB NB102 | 24-CSE III!H6: AD&ST LAB (NB309)/BDA LAB NB102	2026-11-01 18:46:17.159+00
E_db498759-d31d-4091-8cc8-423aa8717a34	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II}	SUB_CSE3105	F_ANANTHA_RAO	R_NB313	FRIDAY	S7	LECTURE	t	t	24-CSE I!H6: AD&ST LAB (NB309)/ADS CSEI+CSEII NB 313/BDA LAB NB102 | 24-CSE II!H6: AD&ST LAB(NB309) /ADS CSEI+CSEII NB 313/BDA LAB NB102	2026-11-01 18:46:17.159+00
E_9533cc19-817f-4558-9038-38f7a6d84291	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_I	{2024_CSE_II,2024_CSE_III,2024_CSE_IV,2024_CSE_V,2024_CSE_VI,2024_CSE_VII,2024_CSE_VIII,2024_ECOM}	SUB_CSE3712	F_YOGESH_GUPTA	R_NB102	FRIDAY	S7	LAB	t	t	24-CSE I!H6: AD&ST LAB (NB309)/ADS CSEI+CSEII NB 313/BDA LAB NB102 | 24-CSE II!H6: AD&ST LAB(NB309) /ADS CSEI+CSEII NB 313/BDA LAB NB102 | 24-CSE III!H6: AD&ST LAB (NB309)/BDA LAB NB102	2026-11-01 18:46:17.159+00
E_e05c17a1-5cd1-4cbc-a616-7097e855382f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB311	MONDAY	S2	LECTURE	f	t	24-CSE II!C2: SE NB 311	2026-11-01 18:46:17.159+00
E_0ea72414-9b60-4ae9-bf73-f32de55e05a2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_GA202B	MONDAY	S5	LAB	f	t	24-CSE II!F2: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_58c820e1-93b4-446c-a90b-6458384da135	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_GA202B	MONDAY	S6	LAB	f	t	24-CSE II!G2: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_8dbc0f3c-4cfb-47d4-acf2-44205596a622	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB209	TUESDAY	S1	LAB	f	t	24-CSE II!B3: SE LAB NB209	2026-11-01 18:46:17.159+00
E_94963ebe-7d97-4360-9776-c5b448a97380	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB209	TUESDAY	S2	LAB	f	t	24-CSE II!C3: SE LAB NB209	2026-11-01 18:46:17.159+00
E_ee3b844f-d702-4412-b049-c1033649bd41	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB311	TUESDAY	S6	LECTURE	f	t	24-CSE II!G3: COA NB 311	2026-11-01 18:46:17.159+00
E_c0c3cff2-a702-406a-8e6a-5de50b1d6279	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB309	TUESDAY	S7	LAB	f	t	24-CSE II!H3: ML LAB NB309	2026-11-01 18:46:17.159+00
E_11a1e376-8149-4771-9f7d-38fb8d0d22c5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB309	TUESDAY	S8	LAB	f	t	24-CSE II!I3: ML LAB NB309	2026-11-01 18:46:17.159+00
E_dc5cee34-c09b-45b9-a7f4-87f70919a80d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB311	WEDNESDAY	S3	LECTURE	f	t	24-CSE II!D4: COA NB 311	2026-11-01 18:46:17.159+00
E_d3e0e8d1-f6e9-431e-992a-f74e5e8045d4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB311	WEDNESDAY	S5	LECTURE	f	t	24-CSE II!F4: AI NB 311	2026-11-01 18:46:17.159+00
E_be1fff69-f454-4b4d-a64e-25a935eb875a	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB311	THURSDAY	S1	LECTURE	f	t	24-CSE II!B5: AI NB 311	2026-11-01 18:46:17.159+00
E_c949b343-17c7-4e85-8c17-e6c17189d177	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB311	THURSDAY	S2	LECTURE	f	t	24-CSE II!C5: ML NB 311	2026-11-01 18:46:17.159+00
E_a2aa6414-7148-46e9-b630-4e6c48e8dab0	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB311	THURSDAY	S3	LECTURE	f	t	24-CSE II!D5: ML NB 311	2026-11-01 18:46:17.159+00
E_ed5eed42-4845-487e-82bd-767bf1753d26	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB311	THURSDAY	S6	PROJECT	f	t	24-CSE II!G5: PRJ 1 NB 311	2026-11-01 18:46:17.159+00
E_f392f7b2-d802-4350-bb6f-c1f2623a31e8	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB311	THURSDAY	S7	LECTURE	f	t	24-CSE II!H5: COD SKL NB 311	2026-11-01 18:46:17.159+00
E_f657667b-f003-404f-8b76-3beb77779e2c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB311	THURSDAY	S8	LECTURE	f	t	24-CSE II!I5: COD SKL NB 311	2026-11-01 18:46:17.159+00
E_6d53b048-2440-4c8b-90bb-1749834302bd	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB312	FRIDAY	S1	LECTURE	f	t	24-CSE II!B6: COA NB 312	2026-11-01 18:46:17.159+00
E_3f4f6f41-a7a8-4072-a4a0-46c4a2dcff8a	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB311	FRIDAY	S2	LECTURE	f	t	24-CSE II!C6: AI NB 311	2026-11-01 18:46:17.159+00
E_7032bcf8-0de4-4c6c-b174-4b4f53b3b439	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB311	FRIDAY	S3	LECTURE	f	t	24-CSE II!D6: SE NB 311	2026-11-01 18:46:17.159+00
E_a000472c-6940-423a-b757-1952ccf569c5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_II	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_NB311	FRIDAY	S5	LECTURE	f	t	24-CSE II!F6: IoT-NAA NB 311	2026-11-01 18:46:17.159+00
E_cc132c10-ffaf-4d9c-a714-5cd4def48958	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB312	MONDAY	S1	LECTURE	f	t	24-CSE III!B2: COD SKL NB 312	2026-11-01 18:46:17.159+00
E_bc332254-5458-4a93-904b-ffc86857e1df	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB312	MONDAY	S2	LECTURE	f	t	24-CSE III!C2: COD SKL NB 312	2026-11-01 18:46:17.159+00
E_33e018ff-137f-4594-9d59-8b57751e91f5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB312	MONDAY	S3	LECTURE	f	t	24-CSE III!D2: ML NB 312	2026-11-01 18:46:17.159+00
E_31bbafef-bcb6-4ab3-9ce5-543241e81a01	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{2024_CSE_IV}	SUB_CSE3105	F_ANANTHA_RAO	R_NB312	MONDAY	S5	LECTURE	t	t	24-CSE III!F2: ADS CSEIII+CSEIV NB 312 | 24-CSE IV!F2: ADS CSEIII+CSEIV NB 312	2026-11-01 18:46:17.159+00
E_358b4d25-d48e-4763-82c8-631ab7881e5d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3705	F_ANUSHA_CHHABRA	R_NB311	MONDAY	S6	LECTURE	f	t	24-CSE III!G2: AI NB 311	2026-11-01 18:46:17.159+00
E_e24682b0-8d56-421a-8e8f-1ea828d146c1	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_GA202B	TUESDAY	S1	LAB	f	t	24-CSE III!B3: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_09174548-184b-4591-90b3-7dbfc055e961	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_GA202B	TUESDAY	S2	LAB	f	t	24-CSE III!C3: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_980de183-a418-4c97-8dab-93ba354f467d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB312	TUESDAY	S3	LECTURE	f	t	24-CSE III!D3: COA NB 312	2026-11-01 18:46:17.159+00
E_8bcf0369-1579-456d-96a3-7393254b99a7	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB208	TUESDAY	S5	LAB	f	t	24-CSE III!F3: ML LAB NB208	2026-11-01 18:46:17.159+00
E_6e498026-0f18-4646-9355-6f0127ea7ef4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB208	TUESDAY	S6	LAB	f	t	24-CSE III!G3: ML LAB NB208	2026-11-01 18:46:17.159+00
E_aa027847-9985-4a12-ac75-07e79c311fea	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3705	F_ANUSHA_CHHABRA	R_NB311	TUESDAY	S7	LECTURE	f	t	24-CSE III!H3: AI NB 311	2026-11-01 18:46:17.159+00
E_bff95363-0dff-46ac-8a56-dc8c7d40e835	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB307	TUESDAY	S8	PROJECT	f	t	24-CSE III!I3: PRJ 1 NB 307	2026-11-01 18:46:17.159+00
E_9af59311-a6d2-42f1-826b-ea29607a0cf8	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB307	TUESDAY	S9	PROJECT	f	t	24-CSE III!J3: PRJ 1 NB 307	2026-11-01 18:46:17.159+00
E_63e28cd3-94f2-426e-895a-b9e1484fb140	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB312	WEDNESDAY	S3	LECTURE	f	t	24-CSE III!D4: SE NB 312	2026-11-01 18:46:17.159+00
E_f78a380d-dd7c-4c90-8f8f-2087f7bc2111	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{2024_CSE_IV}	SUB_CSE3105	F_ANANTHA_RAO	R_NB312	WEDNESDAY	S5	LECTURE	t	t	24-CSE III!F4: ADS CSEIII+CSEIV NB 312 | 24-CSE IV!F4: ADS CSEIII+CSEIV NB 312	2026-11-01 18:46:17.159+00
E_7820f205-6b70-48c5-9c88-86c03e0d225b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB312	WEDNESDAY	S6	LECTURE	f	t	24-CSE III!G4: COA NB 312	2026-11-01 18:46:17.159+00
E_045d5081-6b78-410c-b112-14deca9eaf7f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB312	THURSDAY	S1	LECTURE	f	t	24-CSE III!B5: COA NB 312	2026-11-01 18:46:17.159+00
E_e859a6f1-d26e-42c5-bd0f-30786f932cc2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB209	THURSDAY	S2	LAB	f	t	24-CSE III!C5: SE LAB NB209	2026-11-01 18:46:17.159+00
E_bf072496-1f68-4a70-b2d8-5efb4449a533	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB209	THURSDAY	S3	LAB	f	t	24-CSE III!D5: SE LAB NB209	2026-11-01 18:46:17.159+00
E_44c26ec0-86e0-47d8-b0b8-f1757c73d268	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE2032	F_SHRADDHA_ARORA	R_NB312	THURSDAY	S5	LECTURE	f	t	24-CSE III!F5: ML NB 312	2026-11-01 18:46:17.159+00
E_409823f3-8567-459e-ae17-a9443c2d36e7	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_NB312	THURSDAY	S6	LECTURE	f	t	24-CSE III!G5: IoT-NAA NB 312	2026-11-01 18:46:17.159+00
E_d015e2a8-10d7-4cc4-a74c-041407ea4ac8	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3705	F_ANUSHA_CHHABRA	R_NB311	FRIDAY	S1	LECTURE	f	t	24-CSE III!B6: AI NB 311	2026-11-01 18:46:17.159+00
E_d9e0ed40-a269-4eee-932d-d5fa4c703447	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3722	F_SANDEEP_KUMAR	R_NB312	FRIDAY	S3	LECTURE	f	t	24-CSE III!D6: IoT-NAA NB 312	2026-11-01 18:46:17.159+00
E_865d8ab3-a235-48e0-aed7-14fd393049c4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{2024_CSE_IV}	SUB_CSE3105	F_ANANTHA_RAO	R_NB209	FRIDAY	S5	LAB	t	t	24-CSE III!F6: ADS LAB CSEIII+CSEIV NB209 | 24-CSE IV!F6: ADS LAB CSEIII+CSEIV NB209	2026-11-01 18:46:17.159+00
E_b466d5dc-3c62-4452-8449-46d67b9dd24b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{2024_CSE_IV}	SUB_CSE3105	F_ANANTHA_RAO	R_NB209	FRIDAY	S6	LAB	t	t	24-CSE III!G6: AD&ST LAB (NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSEIII+CSEIV NB209 | 24-CSE IV!G6: AD&ST LAB(NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSEIII+CSEIV NB209	2026-11-01 18:46:17.159+00
E_40b27de9-70e8-488e-8f22-3504ff37fb5a	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_III	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB312	FRIDAY	S8	LECTURE	f	t	24-CSE III!I6: SE NB 312	2026-11-01 18:46:17.159+00
E_9ac38485-3d0d-4ec0-bb11-4f0cc7eabd1e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_MECHATRONICS_LAB_WORKSHOP_AREA	MONDAY	S1	PROJECT	f	f	24-CSE IV!B2: PRJ 1Mechatronics Lab Workshop	2026-11-01 18:46:17.159+00
E_f13e51bc-11aa-4c4c-b989-8b06dbd180ea	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3722	F_ABHISHEK_JAIN	R_NB313	MONDAY	S2	LECTURE	f	t	24-CSE IV!C2: IoT-NAA NB 313	2026-11-01 18:46:17.159+00
E_acd0e883-8570-4660-9324-36566dc1c18d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3705	F_ANUSHA_CHHABRA	R_NB313	MONDAY	S3	LECTURE	f	t	24-CSE IV!D2: AI NB 313	2026-11-01 18:46:17.159+00
E_3035fd6e-99cc-41b6-98a3-00e2c1f99c39	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB313	MONDAY	S6	LECTURE	f	t	24-CSE IV!G2: COA NB 313	2026-11-01 18:46:17.159+00
E_44f70eea-9a37-41b0-93a3-5d0df58e54bf	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB309	TUESDAY	S1	LAB	f	t	24-CSE IV!B3: ML LAB NB309	2026-11-01 18:46:17.159+00
E_99f9978c-557a-4dcc-a99f-a8ab475617ca	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB309	TUESDAY	S2	LAB	f	t	24-CSE IV!C3: ML LAB NB309	2026-11-01 18:46:17.159+00
E_b307744e-4c25-498a-bc97-b2ff40e15553	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3705	F_ANUSHA_CHHABRA	R_NB313	TUESDAY	S3	LECTURE	f	t	24-CSE IV!D3: AI NB 313	2026-11-01 18:46:17.159+00
E_30bfccde-1a3e-4a28-8f35-8bc5a80631cc	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB312	TUESDAY	S5	LECTURE	f	t	24-CSE IV!F3: COD SKL NB 312	2026-11-01 18:46:17.159+00
E_dceaa026-c5dd-474c-ba01-95cbdba7d4d1	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB312	TUESDAY	S6	LECTURE	f	t	24-CSE IV!G3: COD SKL NB 312	2026-11-01 18:46:17.159+00
E_66040913-a33b-4c10-90e0-fc21b263a556	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3005	F_SUKHANDEEP_KAUR	R_NB209	TUESDAY	S7	LAB	f	t	24-CSE IV!H3: SE LAB NB209	2026-11-01 18:46:17.159+00
E_9e8fac70-afce-4ab6-98f5-744bc95ff4b6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3005	F_SUKHANDEEP_KAUR	R_NB209	TUESDAY	S8	LAB	f	t	24-CSE IV!I3: SE LAB NB209	2026-11-01 18:46:17.159+00
E_2d0f5131-acd5-43ed-b3cc-ae3fb71228a2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB312	TUESDAY	S9	PROJECT	f	t	24-CSE IV!J3: PRJ 1 NB 312	2026-11-01 18:46:17.159+00
E_d430d39a-30c3-4e31-adb3-5ecbe66afa97	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3705	F_ANUSHA_CHHABRA	R_NB313	WEDNESDAY	S3	LECTURE	f	t	24-CSE IV!D4: AI NB 313	2026-11-01 18:46:17.159+00
E_215acb9a-8710-40ef-8341-6338c15d387a	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB311	WEDNESDAY	S6	LECTURE	f	t	24-CSE IV!G4: ML NB 311	2026-11-01 18:46:17.159+00
E_f5a19d48-db37-4c4b-a3e0-bc90284456e3	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB313	THURSDAY	S1	LECTURE	f	t	24-CSE IV!B5: SE NB 313	2026-11-01 18:46:17.159+00
E_daad6dbf-cd97-45aa-9809-6554803bad87	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3722	F_ABHISHEK_JAIN	R_GA202B	THURSDAY	S2	LAB	f	t	24-CSE IV!C5: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_af7d4872-3f02-4128-944e-f4cf959a9272	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3722	F_ABHISHEK_JAIN	R_GA202B	THURSDAY	S3	LAB	f	t	24-CSE IV!D5: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_3c7e0ace-5a00-4b34-9375-303f0e5d07bc	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB311	THURSDAY	S5	LECTURE	f	t	24-CSE IV!F5: ML NB 311	2026-11-01 18:46:17.159+00
E_bbf4ab6f-8e57-42f1-815a-079768df131b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB313	THURSDAY	S6	LECTURE	f	t	24-CSE IV!G5: COA NB 313	2026-11-01 18:46:17.159+00
E_93a84069-775a-4d51-a834-2ddf10b099b2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB313	FRIDAY	S1	LECTURE	f	t	24-CSE IV!B6: SE NB 313	2026-11-01 18:46:17.159+00
E_00efee82-9067-4f95-98d3-6fd110ac1ba5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE2709	F_SATYENDR_SINGH	R_NB313	FRIDAY	S2	LECTURE	f	t	24-CSE IV!C6: COA NB 313	2026-11-01 18:46:17.159+00
E_534f473d-7072-4842-bed9-bec06e199c9f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_IV	{}	SUB_CSE3722	F_ABHISHEK_JAIN	R_NB313	FRIDAY	S3	LECTURE	f	t	24-CSE IV!D6: IoT-NAA NB 313	2026-11-01 18:46:17.159+00
E_977a4ddd-b7a2-4d86-9949-e9a828e8216d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB314	MONDAY	S1	PROJECT	f	t	24-CSE V!B2: PRJ 1 NB 314	2026-11-01 18:46:17.159+00
E_015cfd85-55c3-4cbf-b3cf-567f991a36d0	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB314	MONDAY	S2	PROJECT	f	t	24-CSE V!C2: PRJ 1 NB 314	2026-11-01 18:46:17.159+00
E_d05bb3ef-6616-43cb-9431-87dd9fa9952d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB209	MONDAY	S3	LAB	f	t	24-CSE V!D2: SE LAB NB209	2026-11-01 18:46:17.159+00
E_3ecce869-1b8e-408b-bc00-cbab64977d5e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB209	MONDAY	S4	LAB	f	t	24-CSE V!E2: SE LAB NB209	2026-11-01 18:46:17.159+00
E_63e350ea-4cdf-4b56-b6cb-5e2de1e38666	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB314	MONDAY	S5	LECTURE	f	t	24-CSE V!F2: COA NB 314	2026-11-01 18:46:17.159+00
E_697adcb3-5872-44b8-9b9b-375241bff6c7	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{2024_CSE_VI}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB208	MONDAY	S7	LAB	t	t	24-CSE V!H2: ADS CSE V +CSEVI LAB (NB208)/CE&DHA LAB NB309 /BDA 307/SAD NB 311/AD&ST NB 312 | 24-CSE VI!H2: ADS CSE V +CSEVI LAB (NB208) /CE&DHA LAB NB309 /BDA 307/SAD 311/AD&ST 312	2026-11-01 18:46:17.159+00
E_f08758ad-1a9e-4b04-bc56-368e296e8c1b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{2024_CSE_VI}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB208	MONDAY	S8	LAB	t	t	24-CSE V!I2: ADS CSE V +CSEVI LAB (NB208) /CE&DHA LAB NB309 | 24-CSE VI!I2: ADS CSE V +CSEVI LAB (NB208) /CE&DHA LAB NB309	2026-11-01 18:46:17.159+00
E_0092ae1b-3f79-439b-96d3-abc9292f9e3f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB307	TUESDAY	S1	LECTURE	f	t	24-CSE V!B3: COD SKL NB 307	2026-11-01 18:46:17.159+00
E_fa772ce9-03dc-4d2a-9295-7bcc090a57f4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB307	TUESDAY	S2	LECTURE	f	t	24-CSE V!C3: COD SKL NB 307	2026-11-01 18:46:17.159+00
E_d7219306-c4e1-4103-ba26-9312ee212a8b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB314	TUESDAY	S3	LECTURE	f	t	24-CSE V!D3: AI NB 314	2026-11-01 18:46:17.159+00
E_d1d35e37-cb91-4ac4-a95a-a8524ddc0ee9	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB313	TUESDAY	S5	LECTURE	f	t	24-CSE V!F3: SE NB 313	2026-11-01 18:46:17.159+00
E_21379b2c-cb9e-40ed-9fc5-bdd9b9f66b8d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_NB313	TUESDAY	S6	LECTURE	f	t	24-CSE V!G3: IoT-NAA NB 313	2026-11-01 18:46:17.159+00
E_c8b0591d-4505-4e7b-9d92-a70170094e80	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB208	TUESDAY	S7	LAB	f	t	24-CSE V!H3: ML LAB NB208	2026-11-01 18:46:17.159+00
E_ba409aa2-4cce-49d7-b4a6-be38056747fb	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB208	TUESDAY	S8	LAB	f	t	24-CSE V!I3: ML LAB NB208	2026-11-01 18:46:17.159+00
E_86f81200-2c4f-4b56-a6ff-d901aae6718e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{2024_CSE_VI}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB315	WEDNESDAY	S2	LECTURE	t	t	24-CSE V!C4: ADS CSE V +CSEVI NB 315/ CE&DHA NB 314 /BDA 307 /SAD NB 311 /AD&ST NB 312 | 24-CSE VI!C4: ADS CSE V +CSEVI NB 315/CE&DHA 314 /BDA 307 /SAD 311 /AD&ST 312	2026-11-01 18:46:17.159+00
E_21ce634f-68c5-4d65-99a5-fcb3961fc874	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_GA202B	WEDNESDAY	S3	LAB	f	t	24-CSE V!D4: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_33d4080a-0b41-46db-a837-244cd3614b2b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_GA202B	WEDNESDAY	S4	LAB	f	t	24-CSE V!E4: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_3f499a03-0972-4fe8-b1bb-faa5288c6bc4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3005	F_SHILPA_MAHAJAN	R_NB313	WEDNESDAY	S5	LECTURE	f	t	24-CSE V!F4: SE NB 313	2026-11-01 18:46:17.159+00
E_32bcf46e-e45a-4fe5-bfc2-8bd3ae7e0ea4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB314	THURSDAY	S1	LECTURE	f	t	24-CSE V!B5: COA NB 314	2026-11-01 18:46:17.159+00
E_46e89da1-f41a-415f-83e5-2d0ccef1e517	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB314	THURSDAY	S2	LECTURE	f	t	24-CSE V!C5: ML NB 314	2026-11-01 18:46:17.159+00
E_50a77758-9e94-45b1-ac8e-ddb9576916d0	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_NB313	THURSDAY	S3	LECTURE	f	t	24-CSE V!D5: IoT-NAA NB 313	2026-11-01 18:46:17.159+00
E_24f3ee02-1c5b-48bd-9765-dfd9f315f290	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB314	THURSDAY	S5	LECTURE	f	t	24-CSE V!F5: AI NB 314	2026-11-01 18:46:17.159+00
E_ccafb936-5afb-4bc6-a1a8-1086d5b4428c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB314	FRIDAY	S2	LECTURE	f	t	24-CSE V!C6: COA NB 314	2026-11-01 18:46:17.159+00
E_e8ed7ad3-0fa9-4ef4-953d-9d22eeb7ac18	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE2032	F_SUBHANKAR_GHATAK	R_NB314	FRIDAY	S3	LECTURE	f	t	24-CSE V!D6: ML NB 314	2026-11-01 18:46:17.159+00
E_b492ded3-9a6c-435f-ad96-098419fe9864	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{}	SUB_CSE3705	F_SUKHANDEEP_KAUR	R_NB314	FRIDAY	S4	LECTURE	f	t	24-CSE V!E6: AI NB 314	2026-11-01 18:46:17.159+00
E_31c931a9-5286-4927-bd76-86123782ad86	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_V	{2024_CSE_VI}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB315	FRIDAY	S7	LECTURE	t	t	24-CSE V!H6: AD&ST LAB (NB309)/ADS CSE V +CSEVI NB 315/BDA LAB NB102 | 24-CSE VI!H6: AD&ST LAB (NB309)/ADS CSE V +CSEVI NB 315 /BDA LAB NB102	2026-11-01 18:46:17.159+00
E_94114ed0-ec80-4457-af6e-8823f410dd79	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_GA202B	MONDAY	S1	LAB	f	t	24-CSE VI!B2: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_1bacb545-ea5a-4fe2-a991-511fd21e38c8	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_GA202B	MONDAY	S2	LAB	f	t	24-CSE VI!C2: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_fbc9e087-6ab2-41fc-8e3f-db08291b5c2f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB314	MONDAY	S3	LECTURE	f	t	24-CSE VI!D2: AI NB 314	2026-11-01 18:46:17.159+00
E_2daba844-2bc4-4f49-9fde-69045c2d08ec	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB208	MONDAY	S5	LAB	f	t	24-CSE VI!F2: SE LAB NB208	2026-11-01 18:46:17.159+00
E_e049890b-69bf-4bcb-a3c5-f93bce3259ef	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB208	MONDAY	S6	LAB	f	t	24-CSE VI!G2: SE LAB NB208	2026-11-01 18:46:17.159+00
E_b7dc1d8d-ee58-4557-9402-a3a4328ffa67	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB312	TUESDAY	S2	LECTURE	f	t	24-CSE VI!C3: SE NB 312	2026-11-01 18:46:17.159+00
E_e166aacf-cf3c-4ab9-b261-569f1fb52cd9	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_NB315	TUESDAY	S3	LECTURE	f	t	24-CSE VI!D3: IoT-NAA 2024 NB 315	2026-11-01 18:46:17.159+00
E_f56ae1d2-e21a-4de5-93ea-28047c3d1bdd	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB314	TUESDAY	S4	LECTURE	f	t	24-CSE VI!E3: AI NB 314	2026-11-01 18:46:17.159+00
E_8e7c4ba4-28a1-4796-a2e0-990a440f0aa5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB315	TUESDAY	S6	LECTURE	f	t	24-CSE VI!G3: COA NB 315	2026-11-01 18:46:17.159+00
E_9bc01eb2-1c9d-47c1-9707-ae6a4dce4e79	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB312	TUESDAY	S7	PROJECT	f	t	24-CSE VI!H3: PRJ 1 NB 312	2026-11-01 18:46:17.159+00
E_ca7eb979-58d8-49e2-b202-f48d322d2fd2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB312	TUESDAY	S8	PROJECT	f	t	24-CSE VI!I3: PRJ 1 NB 312	2026-11-01 18:46:17.159+00
E_44b9e02d-c66a-4247-8ab8-5cddbdb9d022	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB315	WEDNESDAY	S3	LECTURE	f	t	24-CSE VI!D4: COA NB 315	2026-11-01 18:46:17.159+00
E_a2f121b0-464a-43be-ba40-8c1b8ea2d2d6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE2032	F_SOHARAB_HOSSAIN	R_NB208	WEDNESDAY	S5	LAB	f	t	24-CSE VI!F4: ML LAB NB208	2026-11-01 18:46:17.159+00
E_b8b8b979-243b-492c-968c-aa40011496ae	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE2032	F_SOHARAB_HOSSAIN	R_NB208	WEDNESDAY	S6	LAB	f	t	24-CSE VI!G4: ML LAB NB208	2026-11-01 18:46:17.159+00
E_8b7db476-aa89-4b44-8c71-dadd49ae2a1c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3722	F_SUMIT_BADOTRA	R_NB315	THURSDAY	S1	LECTURE	f	t	24-CSE VI!B5: IoT-NAA 2024 NB 315	2026-11-01 18:46:17.159+00
E_54f54da9-8ffc-446d-928a-484c6a274cdd	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB312	THURSDAY	S2	LECTURE	f	t	24-CSE VI!C5: SE NB 312	2026-11-01 18:46:17.159+00
E_1b7b03e9-ccea-4286-922b-b9a800c69675	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB314	THURSDAY	S3	LECTURE	f	t	24-CSE VI!D5: AI NB 314	2026-11-01 18:46:17.159+00
E_1db6d5a2-1cad-4544-9b33-b961a8a6f1a2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB315	THURSDAY	S5	LECTURE	f	t	24-CSE VI!F5: COA NB 315	2026-11-01 18:46:17.159+00
E_2d7767f7-9f09-4012-9ead-5a0360e82681	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE2032	F_HIRDESH_KUMAR_PHARASI	R_NB315	THURSDAY	S6	LECTURE	f	t	24-CSE VI!G5: ML NB 315	2026-11-01 18:46:17.159+00
E_469a3a59-8385-42a7-97b1-7d85112755c6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_CSE2032	F_HIRDESH_KUMAR_PHARASI	R_NB315	FRIDAY	S2	LECTURE	f	t	24-CSE VI!C6: ML NB 315	2026-11-01 18:46:17.159+00
E_677331f5-03e1-45ee-b2ef-9033e9ef97fc	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB315	FRIDAY	S3	LECTURE	f	t	24-CSE VI!D6: COD SKL NB 315	2026-11-01 18:46:17.159+00
E_7b2469e5-de4a-446d-8291-3aecc28356e6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VI	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB315	FRIDAY	S4	LECTURE	f	t	24-CSE VI!E6: COD SKL NB 315	2026-11-01 18:46:17.159+00
E_24f86252-f000-43a7-9b47-41f62490432c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB313	MONDAY	S1	PROJECT	f	t	24-CSE VII!B2: PRJ 1 NB 313	2026-11-01 18:46:17.159+00
E_0a60e168-343b-4cda-b037-db7c28f284c5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_NB315	MONDAY	S2	LECTURE	f	t	24-CSE VII!C2: IoT-NAA NB 315	2026-11-01 18:46:17.159+00
E_cd02ef9d-d658-4769-bbe2-7d07a20b84c0	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_CSE2709	F_ASHOK_SUHAG	R_NB315	MONDAY	S3	LECTURE	f	t	24-CSE VII!D2: COA NB 315 | 24-ECoM!D2: COA NB 315	2026-11-01 18:46:17.159+00
E_e6a1bcb1-e2ba-4d96-b23a-ca7e45304ffa	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_CSE_VIII,2024_ECOM}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB315	MONDAY	S5	LECTURE	t	t	24-CSE VII!F2: ADS CSE VII +CSEVIII + ECOM NB 315 | 24-CSE VIII!F2: ADS CSE VII +CSEVIII + ECOM NB 315 | 24-ECoM!F2: ADS CSE VII +CSEVIII + ECOM NB 315	2026-11-01 18:46:17.159+00
E_9fba6f2f-e551-469c-a268-3f7830439ef1	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB314	MONDAY	S6	LECTURE	f	t	24-CSE VII!G2: AI NB 314	2026-11-01 18:46:17.159+00
E_14af597b-a423-44bb-a66c-6e792504da89	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB313	MONDAY	S9	PROJECT	f	t	24-CSE VII!J2: PRJ 1 NB 313	2026-11-01 18:46:17.159+00
E_61513963-3fc6-40de-b136-1fadebee8747	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_CSE2709	F_ASHOK_SUHAG	R_NB315	TUESDAY	S1	LECTURE	f	t	24-CSE VII!B3: COA NB 315 | 24-ECoM!B3: COA NB 315	2026-11-01 18:46:17.159+00
E_c50618a2-bfb8-4860-8baa-b9894afb2948	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_CSE2032	F_ASIF_IQBAL	R_GA102	TUESDAY	S2	LAB	f	t	24-CSE VII!C3: ML LAB GA 102 | 24-ECoM!C3: ML LAB GA 102	2026-11-01 18:46:17.159+00
E_f3080c2d-d4a8-492f-b021-112315edfb20	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_CSE2032	F_ASIF_IQBAL	R_GA102	TUESDAY	S3	LAB	f	t	24-CSE VII!D3: ML LAB GA 102 | 24-ECoM!D3: ML LAB GA 102	2026-11-01 18:46:17.159+00
E_bfaa2d53-c411-4b18-be70-434730022ab8	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB314	TUESDAY	S5	LECTURE	f	t	24-CSE VII!F3: SE NB 314	2026-11-01 18:46:17.159+00
E_d57efab5-ff24-4ce1-a23f-0727bba4f1db	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB314	TUESDAY	S6	LECTURE	f	t	24-CSE VII!G3: AI NB 314	2026-11-01 18:46:17.159+00
E_e646736a-74fa-4fc1-a7ee-e2e1469a8cd0	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB314	TUESDAY	S7	LECTURE	f	t	24-CSE VII!H3: AI NB 314	2026-11-01 18:46:17.159+00
E_11ca1859-7f9b-4819-8951-fe4dc7fb1890	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_CSE2032	F_ASIF_IQBAL	R_NB214	TUESDAY	S8	LECTURE	f	t	24-CSE VII!I3: ML NB 214 | 24-ECoM!I3: ML NB 214	2026-11-01 18:46:17.159+00
E_40229bfd-c337-4502-9916-d299ef9da108	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3005	F_HARSH_TANEJA	R_GA102	WEDNESDAY	S3	LAB	f	t	24-CSE VII!D4: SE LAB GA102	2026-11-01 18:46:17.159+00
E_94b80107-1e68-45f9-9051-80642dcb2c5e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3005	F_HARSH_TANEJA	R_GA102	WEDNESDAY	S4	LAB	f	t	24-CSE VII!E4: SE LAB GA102	2026-11-01 18:46:17.159+00
E_cfe95563-965f-4fda-ae3f-8e9756f903e4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_CSE_VIII,2024_ECOM}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB315	WEDNESDAY	S5	LECTURE	t	t	24-CSE VII!F4: ADS CSE VII +CSEVIII + ECOM NB 315 | 24-CSE VIII!F4: ADS CSE VII +CSEVIII + ECOM NB 315 | 24-ECoM!F4: ADS CSE VII +CSEVIII + ECOM NB 315/ RTL NB 314 /	2026-11-01 18:46:17.159+00
E_cdeaa763-2264-49ce-990a-de99ad80f602	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_CSE2032	F_ASIF_IQBAL	R_NB215	THURSDAY	S1	LECTURE	f	t	24-CSE VII!B5: ML NB 215 | 24-ECoM!B5: ML NB 215	2026-11-01 18:46:17.159+00
E_4d9f9b33-d8df-405f-9b85-d6f406313fe2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_NB315	THURSDAY	S2	LECTURE	f	t	24-CSE VII!C5: IoT-NAA NB 315	2026-11-01 18:46:17.159+00
E_9ba3a8d4-6c0f-4a20-9d0b-01d0a699cf5b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_CSE2709	F_ASHOK_SUHAG	R_NB315	THURSDAY	S3	LECTURE	f	t	24-CSE VII!D5: COA NB 315 | 24-ECoM!D5: COA NB 315	2026-11-01 18:46:17.159+00
E_63d015db-9038-446a-b8d5-7d20211e6c7d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_GA202B	THURSDAY	S5	LAB	f	t	24-CSE VII!F5: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_0c6e1570-cd24-4ef3-b2d4-fbc00969db16	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_GA202B	THURSDAY	S6	LAB	f	t	24-CSE VII!G5: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_b56fa250-e6ac-4d1b-9a8a-aaa2e58fd475	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_SKL3707	F_VISITING_FACULTY	R_NB215	FRIDAY	S1	LECTURE	f	t	24-CSE VII!B6: COD SKL NB 215 | 24-ECoM!B6: COD SKL NB 215	2026-11-01 18:46:17.159+00
E_b226b3a0-b5ac-4442-a1a2-c2d809290f93	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_ECOM}	SUB_SKL3707	F_VISITING_FACULTY	R_NB215	FRIDAY	S2	LECTURE	f	t	24-CSE VII!C6: COD SKL NB 215 | 24-ECoM!C6: COD SKL NB 215	2026-11-01 18:46:17.159+00
E_9e329107-53f3-45fc-8986-a5476e142969	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB215	FRIDAY	S3	LECTURE	f	t	24-CSE VII!D6: SE NB 215	2026-11-01 18:46:17.159+00
E_03007e12-2762-498d-bb15-55fdbb63bd38	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_CSE_VIII,2024_ECOM}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB208	FRIDAY	S5	LAB	t	t	24-CSE VII!F6: ADS LAB CSE VII +CSEVIII + ECOM (NB208) | 24-CSE VIII!F6: ADS LAB CSE VII +CSEVIII + ECOM (NB208) | 24-ECoM!F6: ADS LAB CSE VII +CSEVIII + ECOM (NB208)/ RTL NB 314	2026-11-01 18:46:17.159+00
E_9c1ed812-c115-4e83-aa9d-1e932753b59f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VII	{2024_CSE_VIII,2024_ECOM}	SUB_CSE3105	F_HIRDESH_KUMAR_PHARASI	R_NB208	FRIDAY	S6	LAB	t	t	24-CSE VII!G6: AD&ST LAB (NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSE VII +CSEVIII + ECOM (NB208) | 24-CSE VIII!G6: AD&ST LAB (NB309)/BDA LAB NB102 /SAD NB311 /CE&DHA NB 314/ADS LAB CSE VII +CSEVIII + ECOM (NB208) | 24-ECoM!G6: BDA LAB NB102/CE&DHA NB 314/ADS LAB CSE VII +CSEVIII + ECOM (NB208)/CS LAB GA102B	2026-11-01 18:46:17.159+00
E_153a6ea2-9d0c-4a94-8d5c-ea002aab099d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB315	MONDAY	S1	LECTURE	f	t	24-CSE VIII!B2: AI NB 315	2026-11-01 18:46:17.159+00
E_a16bcd0e-663d-4a4f-a129-75b4981bb6cb	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE2032	F_HARSH_TANEJA	R_NB215	MONDAY	S2	LECTURE	f	t	24-CSE VIII!C2: ML NB 215	2026-11-01 18:46:17.159+00
E_1372708c-ac67-468c-8fab-9d91cd4812ad	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB215	MONDAY	S3	LECTURE	f	t	24-CSE VIII!D2: SE NB 215	2026-11-01 18:46:17.159+00
E_a7a39228-00f5-452a-83ca-bcff31aac638	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_NB312	MONDAY	S6	LECTURE	f	t	24-CSE VIII!G2: IoT-NAA NB 312	2026-11-01 18:46:17.159+00
E_01cbfefe-b927-4ced-b0b2-0891c30b96df	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_NB312	MONDAY	S9	PROJECT	f	t	24-CSE VIII!J2: PRJ 1 NB 312	2026-11-01 18:46:17.159+00
E_579154c8-d3cc-4b38-9d03-4da040a0258c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3005	F_HARSH_TANEJA	R_NB312	TUESDAY	S1	LECTURE	f	t	24-CSE VIII!B3: SE NB 312	2026-11-01 18:46:17.159+00
E_875dcad9-4fe2-4de8-8544-fef888dd696e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB313	TUESDAY	S2	LECTURE	f	t	24-CSE VIII!C3: AI NB 313	2026-11-01 18:46:17.159+00
E_af483ccb-429b-42b1-a1c1-dbbcc9e0845e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB215	TUESDAY	S3	LECTURE	f	t	24-CSE VIII!D3: COD SKL NB 215	2026-11-01 18:46:17.159+00
E_c1b19519-42d6-44d0-afb6-7f8394163008	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_SKL3707	F_VISITING_FACULTY	R_NB215	TUESDAY	S4	LECTURE	f	t	24-CSE VIII!E3: COD SKL NB 215	2026-11-01 18:46:17.159+00
E_e7f7f5cc-2b7e-4bb1-b794-958a8db8ee21	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE2032	F_HARSH_TANEJA	R_NB102	TUESDAY	S6	LAB	f	t	24-CSE VIII!G3: ML LAB NB102	2026-11-01 18:46:17.159+00
E_df8efb4a-7395-43cb-bdc2-5fb03d135aa1	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE2032	F_HARSH_TANEJA	R_NB102	TUESDAY	S7	LAB	f	t	24-CSE VIII!H3: ML LAB NB102	2026-11-01 18:46:17.159+00
E_31f60424-6ed1-4078-987f-7edbfccd901c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB314	TUESDAY	S8	LECTURE	f	t	24-CSE VIII!I3: COA NB 314	2026-11-01 18:46:17.159+00
E_5f18d833-4b08-4e5e-90eb-f8fb787710f9	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB314	WEDNESDAY	S1	LECTURE	f	t	24-CSE VIII!B4: COA NB 314	2026-11-01 18:46:17.159+00
E_62f38c8c-416d-4ae4-ae09-f6bf74518a3f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_NB313	WEDNESDAY	S6	LECTURE	f	t	24-CSE VIII!G4: IoT-NAA NB 313	2026-11-01 18:46:17.159+00
E_8a38db19-67b1-42b6-9d0e-c95b9f8019d6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_PRJ3908	F_SUKHANDEEP_KAUR	R_MECHATRONICS_LAB_WORKSHOP_AREA	THURSDAY	S1	PROJECT	f	f	24-CSE VIII!B5: PRJ 1 Mechatronics	2026-11-01 18:46:17.159+00
E_581c6c6a-fe98-4d12-868c-62f081865ad5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3705	F_SAURABH_MISHRA	R_NB313	THURSDAY	S2	LECTURE	f	t	24-CSE VIII!C5: AI NB 313	2026-11-01 18:46:17.159+00
E_31915d6a-62d3-460c-a357-029ff4e0b197	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE2032	F_HARSH_TANEJA	R_NB312	THURSDAY	S3	LECTURE	f	t	24-CSE VIII!D5: ML NB 312	2026-11-01 18:46:17.159+00
E_50f67c71-975a-464a-a26f-73cb9d6f62be	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3005	F_NISHTHA_PHUTELA	R_NB209	THURSDAY	S5	LAB	f	t	24-CSE VIII!F5: SE LAB NB209	2026-11-01 18:46:17.159+00
E_0c4bb7b0-dce4-47b4-8a93-cf00bfad8702	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3005	F_NISHTHA_PHUTELA	R_NB209	THURSDAY	S6	LAB	f	t	24-CSE VIII!G5: SE LAB NB209	2026-11-01 18:46:17.159+00
E_7117c5b9-de97-49e7-9dfb-d036ef89714a	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE2709	F_ADITI_PALIT	R_NB314	FRIDAY	S1	LECTURE	f	t	24-CSE VIII!B6: COA NB 314	2026-11-01 18:46:17.159+00
E_75bcf189-3bf9-4c40-8a02-5c438279b8a6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_GA202B	FRIDAY	S2	LAB	f	t	24-CSE VIII!C6: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_0a93245a-87e6-4795-8285-62e9613e8377	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_CSE_VIII	{}	SUB_CSE3722	F_DEEPAK_KUMAR	R_GA202B	FRIDAY	S3	LAB	f	t	24-CSE VIII!D6: IoT-NAA LAB GA202B	2026-11-01 18:46:17.159+00
E_3c007c5d-c8f6-4042-a9b4-9dbba36fb485	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3103	F_NEERAJ_SHARMA	R_GA102B	MONDAY	S2	LAB	f	t	24-ME!C2: FEA & CFD Lab GA102B	2026-11-01 18:46:17.159+00
E_9cdb998f-5e8b-4b0a-a164-f03b21dab2fe	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3103	F_NEERAJ_SHARMA	R_GA102B	MONDAY	S3	LAB	f	t	24-ME!D2: FEA & CFD Lab GA102B	2026-11-01 18:46:17.159+00
E_579df82f-b5ad-4230-be24-cae7ce476fb4	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3101	F_NEERAJ_SHARMA	R_WORKSHOP	MONDAY	S5	LAB	f	f	24-ME!F2: KIN & DYN LAB WORKSHOP	2026-11-01 18:46:17.159+00
E_dc8e5307-20a1-410c-a5aa-46af4ad12d2b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3101	F_NEERAJ_SHARMA	R_WORKSHOP	MONDAY	S6	LAB	f	f	24-ME!G2: KIN & DYN LAB WORKSHOP	2026-11-01 18:46:17.159+00
E_c3c27f25-f014-43fb-a7af-579f6734dc75	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3715	F_SRIKANTH_K	R_NB313	MONDAY	S7	LECTURE	f	t	24-ME!H2: QCAR NB 313	2026-11-01 18:46:17.159+00
E_c3eb6be1-a246-4e48-b4b7-4f312e8252b2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3105	F_N_C_KAUSHIK	R_WORKSHOP	TUESDAY	S2	LAB	f	f	24-ME!C3: MCF LAB WORKSHOP	2026-11-01 18:46:17.159+00
E_ed7b7425-9813-4e93-9f2d-e0daa72b9c44	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3105	F_N_C_KAUSHIK	R_WORKSHOP	TUESDAY	S3	LAB	f	f	24-ME!D3: MCF LAB WORKSHOP	2026-11-01 18:46:17.159+00
E_b062ddee-6193-435c-80d1-d78a778a501e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3102	F_SUSHIL_CHANDRA	R_NB315	TUESDAY	S5	LECTURE	f	t	24-ME!F3: IC ENG NB315	2026-11-01 18:46:17.159+00
E_ea4776fb-c8cd-49b2-ad91-c60a5f02aa54	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC4013	F_AMIYA_DASH	R_WORKSHOP	TUESDAY	S6	LECTURE	t	f	24-ME!G3: BEVT/D&CS WORKSHOP	2026-11-01 18:46:17.159+00
E_f85eb53d-6bc0-47de-83e0-23267bf4728f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3104	F_ANUBHAV_AGARWAL	R_WORKSHOP	TUESDAY	S6	LECTURE	t	f	24-ME!G3: BEVT/D&CS WORKSHOP	2026-11-01 18:46:17.159+00
E_fcdc1ed8-d294-4a15-b2a7-503b17cbfe8b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC4013	F_AMIYA_DASH	R_WORKSHOP	TUESDAY	S7	LECTURE	t	f	24-ME!H3: BEVT/D&CS WORKSHOP	2026-11-01 18:46:17.159+00
E_27ba69ea-ff62-43d0-9e88-0d11172dd59d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3104	F_ANUBHAV_AGARWAL	R_WORKSHOP	TUESDAY	S7	LECTURE	t	f	24-ME!H3: BEVT/D&CS WORKSHOP	2026-11-01 18:46:17.159+00
E_068ae594-e016-4aac-a2a3-cbdc873785ae	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_PRJ3908	F_N_C_KAUSHIK	R_GA205	WEDNESDAY	S2	PROJECT	f	t	24-ME!C4: PRJ 1 NB GA 205	2026-11-01 18:46:17.159+00
E_3d12b913-12a8-4e25-8d02-f45fddfb987f	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC4013	F_AMIYA_DASH	R_NB215	WEDNESDAY	S3	LECTURE	t	t	24-ME!D4: BEVT NB215/D&CS NB314	2026-11-01 18:46:17.159+00
E_6322129f-ed5e-4e08-a29c-ba9d30df4b58	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3104	F_ANUBHAV_AGARWAL	R_NB314	WEDNESDAY	S3	LECTURE	t	t	24-ME!D4: BEVT NB215/D&CS NB314	2026-11-01 18:46:17.159+00
E_1293e813-12ca-48f3-a810-8c38897175fe	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC4013	F_AMIYA_DASH	R_NB215	WEDNESDAY	S4	LECTURE	t	t	24-ME!E4: BEVT NB215/D&CS NB314	2026-11-01 18:46:17.159+00
E_605f4f21-35d2-4fcb-989e-75df320767f6	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3104	F_ANUBHAV_AGARWAL	R_NB314	WEDNESDAY	S4	LECTURE	t	t	24-ME!E4: BEVT NB215/D&CS NB314	2026-11-01 18:46:17.159+00
E_78188f59-dcba-447f-8171-904271c24b56	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3101	F_NEERAJ_SHARMA	R_GA204	WEDNESDAY	S6	LECTURE	f	t	24-ME!G4: KIN & DYN GA204	2026-11-01 18:46:17.159+00
E_fbceb923-4564-4f0c-bc7a-c2037dcf8c11	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_PRJ3908	F_N_C_KAUSHIK	R_GA205	THURSDAY	S1	PROJECT	f	t	24-ME!B5: PRJ 1 NB GA 205	2026-11-01 18:46:17.159+00
E_bf5bdd99-8429-4d7e-b914-71e199c1b4b2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3105	F_N_C_KAUSHIK	R_GA204	THURSDAY	S2	LECTURE	f	t	24-ME!C5: MCF GA204	2026-11-01 18:46:17.159+00
E_5c76801f-9909-4665-8bfb-fc7e60111266	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3715	F_SRIKANTH_K	R_NB313	THURSDAY	S5	LECTURE	f	t	24-ME!F5: QCAR NB 313	2026-11-01 18:46:17.159+00
E_05164859-d674-4e39-8a07-c22a2b3e8841	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3101	F_NEERAJ_SHARMA	R_NB314	THURSDAY	S6	LECTURE	f	t	24-ME!G5: KIN & DYN NB314	2026-11-01 18:46:17.159+00
E_e8148ec2-1426-4916-a8c6-5a58da963ad5	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3103	F_NEERAJ_SHARMA	R_GA102B	FRIDAY	S2	LAB	f	t	24-ME!C6: FEA & CFD Lab GA102B	2026-11-01 18:46:17.159+00
E_27478442-e349-4e2c-be79-4bbdd809dd0d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3103	F_NEERAJ_SHARMA	R_GA102B	FRIDAY	S3	LAB	f	t	24-ME!D6: FEA & CFD Lab GA102B	2026-11-01 18:46:17.159+00
E_3fb90790-1eae-469c-9831-cd013f701fb0	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3102	F_SUSHIL_CHANDRA	R_WORKSHOP	FRIDAY	S5	LAB	f	f	24-ME!F6: IC ENG LAB WORKSHOP	2026-11-01 18:46:17.159+00
E_f3ae3ced-8a4d-4567-8bdc-cc4093e232ee	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3102	F_SUSHIL_CHANDRA	R_WORKSHOP	FRIDAY	S6	LAB	f	f	24-ME!G6: IC ENG LAB WORKSHOP	2026-11-01 18:46:17.159+00
E_980865f6-85ef-4e4d-a185-a78333580e19	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3101	F_NEERAJ_SHARMA	R_GA204	FRIDAY	S7	LECTURE	f	t	24-ME!H6: KIN & DYN GA204	2026-11-01 18:46:17.159+00
E_e3268162-9444-4123-a7fe-f5254058ba3a	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ME	{}	SUB_MEC3102	F_SUSHIL_CHANDRA	R_NB314	FRIDAY	S8	LECTURE	f	t	24-ME!I6: IC ENG NB314	2026-11-01 18:46:17.159+00
E_c87f2cae-f093-41be-9092-24ffacf01a7d	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3102	F_ASHOK_SUHAG	R_AUTOMATION_LAB_WORKSHOP_AREA	MONDAY	S2	LAB	f	f	24-ECoM!C2: DIG. VLSI Automation Lab Workshop Area	2026-11-01 18:46:17.159+00
E_63a4b63f-d512-41c8-8f33-350b9d35b6d8	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_PRJ3908	F_ASIF_IQBAL	R_AUTOMATION_LAB_WORKSHOP_AREA	MONDAY	S6	PROJECT	f	f	24-ECoM!G2: PRJ I Automation Lab Workshop Area	2026-11-01 18:46:17.159+00
E_c4f6efc5-1d8d-416a-8f70-9db8ef1d2807	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3103	F_POOJA_CHOUDHARY	R_GA102B	MONDAY	S7	LAB	t	t	24-ECoM!H2: CE&DHA LAB NB309 /BDA NB 307//RTL LAB GA102B/CS NB 215	2026-11-01 18:46:17.159+00
E_3cd3120c-b2ff-431e-b594-8cf4e3f60b65	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3007	F_ANUBHAV_AGRAWAL	R_NB215	MONDAY	S7	LECTURE	t	t	24-ECoM!H2: CE&DHA LAB NB309 /BDA NB 307//RTL LAB GA102B/CS NB 215	2026-11-01 18:46:17.159+00
E_5d585551-b809-4cc0-9a70-ec3ef0d23299	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3103	F_POOJA_CHOUDHARY	R_GA102B	MONDAY	S8	LAB	t	t	24-ECoM!I2: CE&DHA LAB NB309 /RTL LAB GA102B	2026-11-01 18:46:17.159+00
E_23ebb898-cc0b-4748-bf21-ba32ab95999c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3101	F_SONU_RATHI	R_GA202B	TUESDAY	S4	LECTURE	f	t	24-ECoM!E3: M&M GA202B	2026-11-01 18:46:17.159+00
E_b0e98e67-8de4-4c16-9aaf-979b39036c43	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3101	F_SONU_RATHI	R_GA202B	TUESDAY	S5	LECTURE	f	t	24-ECoM!F3: M&M GA202B	2026-11-01 18:46:17.159+00
E_e919baa1-01bd-465f-950d-de5cd123ca9e	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3102	F_ASHOK_SUHAG	R_AUTOMATION_LAB_WORKSHOP_AREA	TUESDAY	S7	LAB	f	f	24-ECoM!H3: DIG. VLSI Automation Lab Workshop Area	2026-11-01 18:46:17.159+00
E_2ebd8c6a-2e56-4ab9-83ed-9fa67798ee81	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_PRJ3908	F_ASIF_IQBAL	R_AUTOMATION_LAB_WORKSHOP_AREA	TUESDAY	S9	PROJECT	f	f	24-ECoM!J3: PRJ I Automation Lab Workshop Area	2026-11-01 18:46:17.159+00
E_ee135191-b105-4f0e-a555-d696d0425585	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3007	F_ANUBHAV_AGRAWAL	R_MECHATRONICS_LAB_WORKSHOP_AREA	WEDNESDAY	S2	LAB	t	f	24-ECoM!C4: CE&DHA 314 /BDA NB 307 /CS Mechatronics Lab Workshop Area	2026-11-01 18:46:17.159+00
E_52d76210-a996-4325-8455-6ee5017fb717	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3101	F_SONU_RATHI	R_AUTOMATION_LAB_WORKSHOP_AREA	WEDNESDAY	S3	LAB	f	f	24-ECoM!D4: M&M Automation Lab Workshop Area	2026-11-01 18:46:17.159+00
E_1a0412e4-728d-4874-a1e0-3956e29acc0c	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3103	F_POOJA_CHOUDHARY	R_NB314	WEDNESDAY	S5	LECTURE	t	t	24-ECoM!F4: ADS CSE VII +CSEVIII + ECOM NB 315/ RTL NB 314 /	2026-11-01 18:46:17.159+00
E_31d5a8d9-9ab9-42a1-a308-7f8544706ab2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3101	F_SONU_RATHI	R_AUTOMATION_LAB_WORKSHOP_AREA	THURSDAY	S2	LAB	f	f	24-ECoM!C5: M&M Automation Lab Workshop Area	2026-11-01 18:46:17.159+00
E_56540792-b71d-4b86-ac4d-91f7e52eaaa2	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3102	F_ASHOK_SUHAG	R_GA102B	THURSDAY	S5	LECTURE	f	t	24-ECoM!F5: DIG. VLSI GA102B	2026-11-01 18:46:17.159+00
E_7e876488-cb61-4ae1-889e-ed6d3eb8a20b	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3102	F_ASHOK_SUHAG	R_GA102B	THURSDAY	S6	LECTURE	f	t	24-ECoM!G5: DIG. VLSI GA102B	2026-11-01 18:46:17.159+00
E_1d4af7e5-b776-46b7-b478-94d195e54c78	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3103	F_POOJA_CHOUDHARY	R_NB314	FRIDAY	S5	LECTURE	t	t	24-ECoM!F6: ADS LAB CSE VII +CSEVIII + ECOM (NB208)/ RTL NB 314	2026-11-01 18:46:17.159+00
E_39ac270f-c04d-4378-abb7-eb9c281c5138	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3007	F_ANUBHAV_AGRAWAL	R_GA102B	FRIDAY	S6	LAB	t	t	24-ECoM!G6: BDA LAB NB102/CE&DHA NB 314/ADS LAB CSE VII +CSEVIII + ECOM (NB208)/CS LAB GA102B	2026-11-01 18:46:17.159+00
E_fca53564-173b-43f3-b303-7e32d3c297fc	VER_9fdf6d01-0cfd-434a-98da-656c867333b1	2024_ECOM	{}	SUB_ECE3007	F_ANUBHAV_AGRAWAL	R_GA102B	FRIDAY	S7	LAB	t	t	24-ECoM!H6: CS LAB GA102B/BDA LAB NB102	2026-11-01 18:46:17.159+00
\.


--
-- Data for Name: timetable_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.timetable_versions (id, version_number, name, status, parent_version_id, disruption_id, approved_by, change_log, quality_score, created_at) FROM stdin;
VER_9fdf6d01-0cfd-434a-98da-656c867333b1	v1.0	2024 Batch V wef 24th Aug 26. Ver III	ACTIVE	\N	\N	Timetable import	Imported from "2024 Batch V wef 24th Aug 26. Ver III.xlsx": 253 classes, 120 reserved blocks.	0.00	2026-11-01 18:46:17.148+00
\.


--
-- Data for Name: user_electives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_electives (user_id, subject_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password_hash, role, department, section_id, faculty_id, is_active, token_version, last_login_at, created_at) FROM stdin;
\.


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 19, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: approval_logs approval_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_logs
    ADD CONSTRAINT approval_logs_pkey PRIMARY KEY (id);


--
-- Name: disruptions disruptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disruptions
    ADD CONSTRAINT disruptions_pkey PRIMARY KEY (id);


--
-- Name: faculty faculty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty
    ADD CONSTRAINT faculty_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_connections google_calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (user_id);


--
-- Name: import_batches import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: section_blocks section_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_blocks
    ADD CONSTRAINT section_blocks_pkey PRIMARY KEY (id);


--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: time_slots time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_slots
    ADD CONSTRAINT time_slots_pkey PRIMARY KEY (id);


--
-- Name: timetable_entries timetable_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_entries
    ADD CONSTRAINT timetable_entries_pkey PRIMARY KEY (id);


--
-- Name: timetable_versions timetable_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_versions
    ADD CONSTRAINT timetable_versions_pkey PRIMARY KEY (id);


--
-- Name: user_electives user_electives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_electives
    ADD CONSTRAINT user_electives_pkey PRIMARY KEY (user_id, subject_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: faculty_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX faculty_email_key ON public.faculty USING btree (email);


--
-- Name: idx_entries_section_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entries_section_day ON public.timetable_entries USING btree (version_id, section_id, day_of_week);


--
-- Name: idx_import_source_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_source_hash ON public.import_batches USING btree (source_hash);


--
-- Name: idx_login_attempts_email_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_attempts_email_time ON public.login_attempts USING btree (email, attempted_at);


--
-- Name: idx_notifications_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_status ON public.notifications USING btree (user_id, status);


--
-- Name: idx_users_faculty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_faculty ON public.users USING btree (faculty_id);


--
-- Name: idx_users_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_section ON public.users USING btree (section_id);


--
-- Name: subjects_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subjects_code_key ON public.subjects USING btree (code);


--
-- Name: time_slots_slot_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX time_slots_slot_number_key ON public.time_slots USING btree (slot_number);


--
-- Name: uq_faculty_day_slot_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_faculty_day_slot_version ON public.timetable_entries USING btree (version_id, faculty_id, day_of_week, slot_id) WHERE (session_type <> 'PROJECT'::public."SessionType");


--
-- Name: uq_room_day_slot_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_room_day_slot_version ON public.timetable_entries USING btree (version_id, room_id, day_of_week, slot_id) WHERE room_exclusive;


--
-- Name: uq_section_block; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_section_block ON public.section_blocks USING btree (section_id, day_of_week, slot_id, kind);


--
-- Name: uq_section_core_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_section_core_slot ON public.timetable_entries USING btree (version_id, section_id, day_of_week, slot_id) WHERE (is_elective = false);


--
-- Name: uq_single_active_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_single_active_version ON public.timetable_versions USING btree (status) WHERE (status = 'ACTIVE'::public."VersionStatus");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: timetable_entries trg_entry_room_exclusive; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entry_room_exclusive BEFORE INSERT OR UPDATE OF room_id ON public.timetable_entries FOR EACH ROW EXECUTE FUNCTION public.set_entry_room_exclusive();


--
-- Name: approval_logs approval_logs_approved_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_logs
    ADD CONSTRAINT approval_logs_approved_version_id_fkey FOREIGN KEY (approved_version_id) REFERENCES public.timetable_versions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: approval_logs approval_logs_disruption_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_logs
    ADD CONSTRAINT approval_logs_disruption_id_fkey FOREIGN KEY (disruption_id) REFERENCES public.disruptions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: google_calendar_connections google_calendar_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: section_blocks section_blocks_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_blocks
    ADD CONSTRAINT section_blocks_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: section_blocks section_blocks_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_blocks
    ADD CONSTRAINT section_blocks_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.time_slots(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: timetable_entries timetable_entries_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_entries
    ADD CONSTRAINT timetable_entries_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: timetable_entries timetable_entries_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_entries
    ADD CONSTRAINT timetable_entries_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: timetable_entries timetable_entries_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_entries
    ADD CONSTRAINT timetable_entries_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: timetable_entries timetable_entries_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_entries
    ADD CONSTRAINT timetable_entries_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.time_slots(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: timetable_entries timetable_entries_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_entries
    ADD CONSTRAINT timetable_entries_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: timetable_entries timetable_entries_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_entries
    ADD CONSTRAINT timetable_entries_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.timetable_versions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: timetable_versions timetable_versions_disruption_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_versions
    ADD CONSTRAINT timetable_versions_disruption_id_fkey FOREIGN KEY (disruption_id) REFERENCES public.disruptions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: timetable_versions timetable_versions_parent_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_versions
    ADD CONSTRAINT timetable_versions_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES public.timetable_versions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_electives user_electives_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_electives
    ADD CONSTRAINT user_electives_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_electives user_electives_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_electives
    ADD CONSTRAINT user_electives_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict O8gUIXigxLt9X3ar1oyko8Vtt0OmjpaZuGL2gVAFbKXMeWpALgV6Yns9CLzVpB6

