CREATE TABLE IF NOT EXISTS
  auth_schema.role_permissions (
    permission_id bigint NOT NULL references auth_schema.permissions(id),
    role_id bigint NOT NULL references auth_schema.roles(id),
    CONSTRAINT role_permissions_unique UNIQUE(permission_id, role_id)
  );

