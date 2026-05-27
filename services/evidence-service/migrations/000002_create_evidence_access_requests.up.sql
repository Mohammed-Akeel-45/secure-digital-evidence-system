CREATE TABLE IF NOT EXISTS
  evidence_schema.access_requests (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evidence_id bigint NOT NULL references evidence_schema.evidence(id),
    requested_by bigint NOT NULL,
    approved_by bigint NOT NULL,
    status character varying(40) NOT NULL DEFAULT 'PENDING'::character varying,
    reason text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
