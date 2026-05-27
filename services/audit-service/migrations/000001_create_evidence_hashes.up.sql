CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS integrity_schema.evidence_hashes(
  evidence_id BIGINT PRIMARY KEY,
  evidence_public_id UUID UNIQUE,
  file_hash VARCHAR(128) NOT NULL,
  algorithm VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
