CREATE TABLE IF NOT EXISTS evidence_schema.evidence_versions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evidence_id BIGINT NOT NULL REFERENCES evidence_schema.evidence(id) ON DELETE CASCADE,
    s3_version_id TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size BIGINT,
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_versions_evidence_id ON evidence_schema.evidence_versions(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_versions_hash ON evidence_schema.evidence_versions(file_hash);
