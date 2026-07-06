CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS
  case_schema.cases (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid (),
    org_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    description text NULL,
    status character varying(40) NULL DEFAULT 'OPEN'::character varying,
    priority character varying(20) NULL,
    created_by bigint NULL,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    dept_id bigint NULL
  );

