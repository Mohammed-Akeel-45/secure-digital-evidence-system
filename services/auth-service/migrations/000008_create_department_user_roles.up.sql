CREATE TABLE IF NOT EXISTS
  auth_schema.department_user_roles (
    user_id bigint NOT NULL references auth_schema.users(id),
    role_id bigint NOT NULL references auth_schema.roles(id),
    department_id bigint NOT NULL references auth_schema.departments(id)
  );
