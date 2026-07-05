CREATE TABLE IF NOT EXISTS
  auth_schema.role_permissions (
    permission_id bigint NOT NULL references auth_schema.permissions(id) ON DELETE CASCADE,
    role_id bigint NOT NULL references auth_schema.roles(id) ON DELETE CASCADE,
    CONSTRAINT role_permissions_unique UNIQUE(permission_id, role_id)
  );

