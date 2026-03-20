package service

import (
	"audit-service/internal/store"
	"audit-service/repository"
	"context"
)

type integrityService struct {
	store        *store.Storage
	evidenceRepo repository.EvidenceRepo
	custodyRepo  repository.CustodyRepo
	auditRepo    repository.AuditRepo
}

func NewIntegrityService(store *store.Storage, e repository.EvidenceRepo, c repository.CustodyRepo, a repository.AuditRepo) *integrityService {
	return &integrityService{store, e, c, a}
}

func (i *integrityService) RegisterEvidence(ctx context.Context, evidence store.EvidenceRegistrationDetails) error {
	tx, err := i.store.DB.Begin(ctx)
}
