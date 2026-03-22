package service

import (
	"audit-service/internal/repository"
	"audit-service/internal/store"
)

type auditService struct {
	auditRepo repository.AuditRepo
}

func NewAuditService(store *store.Storage) *auditService {
	auditRepo := repository.NewAuditRepo(store)
	return &auditService{auditRepo}
}
