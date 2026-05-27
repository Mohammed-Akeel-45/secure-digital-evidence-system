CREATE TABLE IF NOT EXISTS
  auth_schema.case_user_roles (
    case_id bigint NOT NULL,
    role_id bigint NOT NULL references auth_schema.roles(id),
    user_id bigint NOT NULL references auth_schema.users(id)
  );
