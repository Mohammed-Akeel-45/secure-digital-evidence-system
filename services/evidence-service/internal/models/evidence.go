package models

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Evidence struct {
	ID          int64     `db:"id"           json:"id"`
	PublicID    string    `db:"public_id"    json:"public_id"`
	CaseID      string    `db:"case_id"      json:"case_id"`
	FileName    string    `db:"file_name"    json:"file_name"`
	FileSize    int64     `db:"file_size"    json:"file_size"`
	StoragePath string    `db:"storage_path" json:"storage_path"`
	CurrentHash string    `db:"current_hash" json:"current_hash"`
	UploadedBy  string    `db:"uploaded_by"  json:"uploaded_by"`
	UploadedAt  time.Time `db:"uploaded_at"  json:"uploaded_at"`
	Status      string    `json:"status"`
}

type EvidenceStatus struct {
	EvidenceID  int64  `json:"evidence_id"`
	Status      string `json:"status"`
	CurrentHash string `json:"current_hash"`
}

type EvidenceVersion struct {
	ID          int64     `db:"id"            json:"id"`
	EvidenceID  int64     `db:"evidence_id"   json:"evidence_id"`
	S3VersionID string    `db:"s3_version_id" json:"s3_version_id"`
	FileHash    string    `db:"file_hash"     json:"file_hash"`
	FileSize    int64     `db:"file_size"     json:"file_size"`
	IsCurrent   bool      `db:"is_current"    json:"is_current"`
	CreatedBy   int64     `db:"created_by"    json:"created_by"`
	CreatedAt   time.Time `db:"created_at"    json:"created_at"`
}

type Claims struct {
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}
