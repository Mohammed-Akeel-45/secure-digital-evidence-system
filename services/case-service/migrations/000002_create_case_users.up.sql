CREATE TABLE IF NOT EXISTS
  case_schema.case_users (
    case_id bigint NOT NULL references case_schema.cases(id) ON DELETE CASCADE,
    user_id bigint NOT NULL,
    assigned_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (case_id, user_id)
  );

