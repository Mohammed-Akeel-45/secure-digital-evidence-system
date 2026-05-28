CREATE TABLE IF NOT EXISTS
  auth_schema.roles (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(50) NOT NULL,
    description text NOT NULL,
    org_id bigint NOT NULL REFERENCES auth_schema.organizations (id) ON DELETE CASCADE
  );

