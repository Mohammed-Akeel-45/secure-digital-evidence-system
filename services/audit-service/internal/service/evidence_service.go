package service

import (
	"audit-service/internal/repository"
	"audit-service/internal/store"
)

type evidenceService struct {
	evidenceRepo repository.EvidenceRepo
}

func NewEvidenceService(store *store.Storage) *evidenceService {
	evidenceRepo := repository.NewEvidenceRepo(store)

	return &evidenceService{evidenceRepo}
}
