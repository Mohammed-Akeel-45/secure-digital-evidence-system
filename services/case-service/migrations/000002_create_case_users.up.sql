CREATE TABLE IF NOT EXISTS
  case_schema.case_users (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id bigint NULL references case_schema.cases(id),
    user_id bigint NULL,
    assigned_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
  );
