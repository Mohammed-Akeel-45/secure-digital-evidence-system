CREATE TABLE IF NOT EXISTS
  auth_schema.permissions (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(64) NULL UNIQUE,
    description text NULL
  );


