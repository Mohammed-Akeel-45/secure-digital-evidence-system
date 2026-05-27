CREATE TABLE IF NOT EXISTS
  auth_schema.departments (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id bigint NULL,
    name text NOT NULL,
    public_id character varying(48) NOT NULL DEFAULT gen_random_uuid ()
  );

