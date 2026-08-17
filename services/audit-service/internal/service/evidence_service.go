package service

import (
	"audit-service/internal/cerrors"
	"audit-service/internal/repository"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"strings"
)

type EvidenceService interface {
	VerifyEvidence(ctx context.Context, evidenceID string, authToken string) (*VerifyEvidenceResult, error)
}

type evidenceService struct {
	evidenceRepo repository.EvidenceRepo
	fileFetcher  FileFetcher
}

func NewEvidenceService(evidenceRepo repository.EvidenceRepo, fileFetcher FileFetcher) EvidenceService {
	if fileFetcher == nil {
		fileFetcher = NewFileFetcher("", nil)
	}
	return &evidenceService{
		evidenceRepo: evidenceRepo,
		fileFetcher:  fileFetcher,
	}
}

type VerifyEvidenceResult struct {
	Status       string `json:"status"` // "VALID", "TAMPERED", "NOT_FOUND", "FILE_NOT_FOUND", "HASHING_ERROR", "FILE_FETCHING_ERROR"
	StoredHash   string `json:"stored_hash,omitempty"`
	ComputedHash string `json:"computed_hash,omitempty"`
	Algorithm    string `json:"algorithm,omitempty"`
	Message      string `json:"message,omitempty"`
}

func computeSHA256Hash(file io.ReadCloser) (string, error) {
	h := sha256.New()
	if _, err := io.Copy(h, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func (e *evidenceService) VerifyEvidence(ctx context.Context, evidenceID string, authToken string) (*VerifyEvidenceResult, error) {
	// 1. Get stored evidence hash from integrity database
	evidenceHash, err := e.evidenceRepo.GetEvidenceHash(ctx, evidenceID)
	if err != nil {
		if errors.Is(err, cerrors.ErrEvidenceNotFound.Error) {
			return &VerifyEvidenceResult{
				Status:  "NOT_FOUND",
				Message: "Evidence hash not found in integrity database",
			}, cerrors.ErrEvidenceNotFound.Error
		}
		return nil, err
	}

	// 2. Fetch evidence file from evidence service
	file, err := e.fileFetcher.GetFile(ctx, evidenceID, authToken)
	if err != nil {
		if errors.Is(err, cerrors.ErrFileNotFound.Error) {
			return &VerifyEvidenceResult{
				Status:     "FILE_NOT_FOUND",
				StoredHash: evidenceHash.FileHash,
				Algorithm:  evidenceHash.Algorithm,
				Message:    "Evidence file not found in storage",
			}, cerrors.ErrFileNotFound.Error
		}
		return &VerifyEvidenceResult{
			Status:     "FILE_FETCHING_ERROR",
			StoredHash: evidenceHash.FileHash,
			Algorithm:  evidenceHash.Algorithm,
			Message:    err.Error(),
		}, err
	}
	defer file.Close()

	// 3. Compute current cryptographic hash of the file stream
	computedHash, err := computeSHA256Hash(file)
	if err != nil {
		return &VerifyEvidenceResult{
			Status:     "HASHING_ERROR",
			StoredHash: evidenceHash.FileHash,
			Algorithm:  evidenceHash.Algorithm,
			Message:    err.Error(),
		}, err
	}

	// 4. Compare current computed hash with the previously registered known-good hash
	if !strings.EqualFold(computedHash, evidenceHash.FileHash) {
		return &VerifyEvidenceResult{
			Status:       "TAMPERED",
			StoredHash:   evidenceHash.FileHash,
			ComputedHash: computedHash,
			Algorithm:    evidenceHash.Algorithm,
			Message:      "Evidence integrity check failed: file hash does not match original registered hash",
		}, nil
	}

	// 5. Hashes match — Integrity Verified
	return &VerifyEvidenceResult{
		Status:       "VALID",
		StoredHash:   evidenceHash.FileHash,
		ComputedHash: computedHash,
		Algorithm:    evidenceHash.Algorithm,
		Message:      "Evidence integrity verified: file hash matches original registered hash",
	}, nil
}
