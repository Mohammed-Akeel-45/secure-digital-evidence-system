CREATE TABLE IF NOT EXISTS
  auth_schema.organization_user_roles (
    org_id bigint NOT NULL references auth_schema.organizations(id),
    role_id bigint NOT NULL references auth_schema.roles(id),
    user_id bigint NOT NULL references auth_schema.users(id)
);
