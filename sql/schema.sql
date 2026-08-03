


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."driver_duty" (
    "id" bigint NOT NULL,
    "schedule_text" "text",
    "code" "text",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."driver_duty" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."driver_duty_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."driver_duty_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."driver_duty_id_seq" OWNED BY "public"."driver_duty"."id";



CREATE TABLE IF NOT EXISTS "public"."duty_officer" (
    "id" bigint NOT NULL,
    "date_key" "date" NOT NULL,
    "d60" "text",
    "d600" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."duty_officer" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."duty_officer_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."duty_officer_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."duty_officer_id_seq" OWNED BY "public"."duty_officer"."id";



CREATE TABLE IF NOT EXISTS "public"."fine_duty" (
    "id" bigint NOT NULL,
    "date_key" "date" NOT NULL,
    "shift_a_text" "text",
    "shift_b_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fine_duty" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."fine_duty_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fine_duty_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."fine_duty_id_seq" OWNED BY "public"."fine_duty"."id";



CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" bigint NOT NULL,
    "date_key" "date" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."holidays_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."holidays_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."holidays_id_seq" OWNED BY "public"."holidays"."id";



CREATE TABLE IF NOT EXISTS "public"."leave_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "date_key" "date" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "point" "text",
    "detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "leave_records_type_check" CHECK (("type" = ANY (ARRAY['leave'::"text", 'official'::"text"])))
);


ALTER TABLE "public"."leave_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "text" NOT NULL,
    "date_key" "date" NOT NULL,
    "type" "text",
    "detail" "text",
    "contact" "text",
    "phone" "text",
    "owner" "text",
    "image1_url" "text",
    "image2_url" "text",
    "time_text" "text",
    "place" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."night_duty" (
    "id" bigint NOT NULL,
    "date_key" "date" NOT NULL,
    "name1" "text",
    "name2" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."night_duty" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."night_duty_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."night_duty_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."night_duty_id_seq" OWNED BY "public"."night_duty"."id";



CREATE TABLE IF NOT EXISTS "public"."officers_rpj1" (
    "id" bigint NOT NULL,
    "seq" integer,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "point" "text",
    "rest_note" "text",
    "rest_dates" "date"[] DEFAULT '{}'::"date"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."officers_rpj1" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."officers_rpj1_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."officers_rpj1_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."officers_rpj1_id_seq" OWNED BY "public"."officers_rpj1"."id";



CREATE TABLE IF NOT EXISTS "public"."officers_rpj2" (
    "id" bigint NOT NULL,
    "seq" integer,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "point" "text",
    "rest_note" "text",
    "rest_dates" "date"[] DEFAULT '{}'::"date"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."officers_rpj2" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."officers_rpj2_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."officers_rpj2_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."officers_rpj2_id_seq" OWNED BY "public"."officers_rpj2"."id";



CREATE TABLE IF NOT EXISTS "public"."radio_duty" (
    "id" bigint NOT NULL,
    "date_key" "date" NOT NULL,
    "code" "text",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."radio_duty" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."radio_duty_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."radio_duty_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."radio_duty_id_seq" OWNED BY "public"."radio_duty"."id";



CREATE TABLE IF NOT EXISTS "public"."rest_periods" (
    "id" bigint NOT NULL,
    "range_text" "text",
    "code" "text",
    "name" "text" NOT NULL,
    "point" "text",
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rest_periods" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rest_periods_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rest_periods_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rest_periods_id_seq" OWNED BY "public"."rest_periods"."id";



CREATE TABLE IF NOT EXISTS "public"."roster" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "position" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roster" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roster_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roster_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roster_id_seq" OWNED BY "public"."roster"."id";



CREATE TABLE IF NOT EXISTS "public"."rush_points" (
    "id" bigint NOT NULL,
    "shift" "text" NOT NULL,
    "day_type" "text" NOT NULL,
    "seq" integer,
    "code" "text",
    "name" "text" NOT NULL,
    "point" "text",
    "rest_note" "text",
    "rest_dates" "date"[] DEFAULT '{}'::"date"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rush_points_day_type_check" CHECK (("day_type" = ANY (ARRAY['odd'::"text", 'even'::"text"]))),
    CONSTRAINT "rush_points_shift_check" CHECK (("shift" = ANY (ARRAY['am'::"text", 'pm'::"text"])))
);


ALTER TABLE "public"."rush_points" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rush_points_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rush_points_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rush_points_id_seq" OWNED BY "public"."rush_points"."id";



ALTER TABLE ONLY "public"."driver_duty" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."driver_duty_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."duty_officer" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."duty_officer_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."fine_duty" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fine_duty_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."holidays" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."holidays_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."night_duty" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."night_duty_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."officers_rpj1" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."officers_rpj1_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."officers_rpj2" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."officers_rpj2_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."radio_duty" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."radio_duty_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rest_periods" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rest_periods_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roster" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roster_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rush_points" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rush_points_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."driver_duty"
    ADD CONSTRAINT "driver_duty_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duty_officer"
    ADD CONSTRAINT "duty_officer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fine_duty"
    ADD CONSTRAINT "fine_duty_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_date_key_key" UNIQUE ("date_key");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_records"
    ADD CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."night_duty"
    ADD CONSTRAINT "night_duty_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."officers_rpj1"
    ADD CONSTRAINT "officers_rpj1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."officers_rpj2"
    ADD CONSTRAINT "officers_rpj2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."radio_duty"
    ADD CONSTRAINT "radio_duty_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rest_periods"
    ADD CONSTRAINT "rest_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roster"
    ADD CONSTRAINT "roster_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rush_points"
    ADD CONSTRAINT "rush_points_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_dutyofficer_date" ON "public"."duty_officer" USING "btree" ("date_key");



CREATE INDEX "idx_fine_date" ON "public"."fine_duty" USING "btree" ("date_key");



CREATE INDEX "idx_leave_code" ON "public"."leave_records" USING "btree" ("code");



CREATE INDEX "idx_leave_date" ON "public"."leave_records" USING "btree" ("date_key");



CREATE INDEX "idx_leave_group" ON "public"."leave_records" USING "btree" ("group_id");



CREATE INDEX "idx_missions_date" ON "public"."missions" USING "btree" ("date_key");



CREATE INDEX "idx_missions_group" ON "public"."missions" USING "btree" ("group_id");



CREATE INDEX "idx_night_date" ON "public"."night_duty" USING "btree" ("date_key");



CREATE INDEX "idx_radio_date" ON "public"."radio_duty" USING "btree" ("date_key");



CREATE INDEX "idx_rest_code" ON "public"."rest_periods" USING "btree" ("code");



CREATE INDEX "idx_rest_dates" ON "public"."rest_periods" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_roster_code" ON "public"."roster" USING "btree" ("code");



CREATE INDEX "idx_rpj1_code" ON "public"."officers_rpj1" USING "btree" ("code");



CREATE INDEX "idx_rpj2_code" ON "public"."officers_rpj2" USING "btree" ("code");



CREATE INDEX "idx_rush_code" ON "public"."rush_points" USING "btree" ("code");



CREATE INDEX "idx_rush_shift_daytype" ON "public"."rush_points" USING "btree" ("shift", "day_type");



ALTER TABLE "public"."driver_duty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."duty_officer" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fine_duty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."night_duty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."officers_rpj1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."officers_rpj2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."radio_duty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rest_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roster" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rush_points" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."driver_duty" TO "anon";
GRANT ALL ON TABLE "public"."driver_duty" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_duty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."driver_duty_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."driver_duty_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."driver_duty_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."duty_officer" TO "anon";
GRANT ALL ON TABLE "public"."duty_officer" TO "authenticated";
GRANT ALL ON TABLE "public"."duty_officer" TO "service_role";



GRANT ALL ON SEQUENCE "public"."duty_officer_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."duty_officer_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."duty_officer_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fine_duty" TO "anon";
GRANT ALL ON TABLE "public"."fine_duty" TO "authenticated";
GRANT ALL ON TABLE "public"."fine_duty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fine_duty_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fine_duty_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fine_duty_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."holidays" TO "service_role";



GRANT ALL ON SEQUENCE "public"."holidays_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."holidays_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."holidays_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_records" TO "anon";
GRANT ALL ON TABLE "public"."leave_records" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_records" TO "service_role";



GRANT ALL ON TABLE "public"."missions" TO "anon";
GRANT ALL ON TABLE "public"."missions" TO "authenticated";
GRANT ALL ON TABLE "public"."missions" TO "service_role";



GRANT ALL ON TABLE "public"."night_duty" TO "anon";
GRANT ALL ON TABLE "public"."night_duty" TO "authenticated";
GRANT ALL ON TABLE "public"."night_duty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."night_duty_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."night_duty_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."night_duty_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."officers_rpj1" TO "anon";
GRANT ALL ON TABLE "public"."officers_rpj1" TO "authenticated";
GRANT ALL ON TABLE "public"."officers_rpj1" TO "service_role";



GRANT ALL ON SEQUENCE "public"."officers_rpj1_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."officers_rpj1_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."officers_rpj1_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."officers_rpj2" TO "anon";
GRANT ALL ON TABLE "public"."officers_rpj2" TO "authenticated";
GRANT ALL ON TABLE "public"."officers_rpj2" TO "service_role";



GRANT ALL ON SEQUENCE "public"."officers_rpj2_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."officers_rpj2_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."officers_rpj2_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."radio_duty" TO "anon";
GRANT ALL ON TABLE "public"."radio_duty" TO "authenticated";
GRANT ALL ON TABLE "public"."radio_duty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."radio_duty_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."radio_duty_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."radio_duty_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rest_periods" TO "anon";
GRANT ALL ON TABLE "public"."rest_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."rest_periods" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rest_periods_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rest_periods_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rest_periods_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roster" TO "anon";
GRANT ALL ON TABLE "public"."roster" TO "authenticated";
GRANT ALL ON TABLE "public"."roster" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roster_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roster_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roster_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rush_points" TO "anon";
GRANT ALL ON TABLE "public"."rush_points" TO "authenticated";
GRANT ALL ON TABLE "public"."rush_points" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rush_points_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rush_points_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rush_points_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







