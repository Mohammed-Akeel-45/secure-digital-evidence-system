CREATE TABLE IF NOT EXISTS auth_schema.user_roles (
    user_id BIGINT NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES auth_schema.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
