CREATE TABLE IF NOT EXISTS
  auth_schema.users (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NULL DEFAULT gen_random_uuid (),
    org_id bigint NULL references auth_schema.organizations(id) on delete cascade,
    dept_id bigint NULL references auth_schema.departments(id),
    name character varying(120) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    is_active boolean NULL DEFAULT true,
    last_login_at timestamp without time zone NULL,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    is_org_admin boolean NOT NULL DEFAULT false
  );

