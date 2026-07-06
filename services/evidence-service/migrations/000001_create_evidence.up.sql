CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS
  evidence_schema.evidence(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid (),
    case_id bigint NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    storage_path text NOT NULL,
    current_hash text NOT NULL,
    hash_algorithm character varying(20) NOT NULL DEFAULT 'SHA-256'::character varying,
    is_encrypted boolean NOT NULL DEFAULT true,
    uploaded_by bigint NOT NULL,
    uploaded_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
