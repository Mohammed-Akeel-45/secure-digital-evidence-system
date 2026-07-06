CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS
  auth_schema.organizations (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NULL DEFAULT gen_random_uuid (),
    name text NOT NULL,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
  );


