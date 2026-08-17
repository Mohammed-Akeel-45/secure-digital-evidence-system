package service

import (
	"audit-service/internal/repository"
	"audit-service/internal/store"
	"context"
)

type AuditService interface {
	GetAuditLogs(ctx context.Context, evidenceID string, caseID string, limit int, offset int) ([]store.AuditLogDTO, error)
	GetAuditLogByID(ctx context.Context, id string) (*store.AuditLogDTO, error)
}

type auditService struct {
	auditRepo repository.AuditRepo
}

func NewAuditService(auditRepo repository.AuditRepo) AuditService {
	return &auditService{auditRepo: auditRepo}
}

func (s *auditService) GetAuditLogs(ctx context.Context, evidenceID string, caseID string, limit int, offset int) ([]store.AuditLogDTO, error) {
	return s.auditRepo.ListAuditLogs(ctx, evidenceID, caseID, limit, offset)
}

func (s *auditService) GetAuditLogByID(ctx context.Context, id string) (*store.AuditLogDTO, error) {
	return s.auditRepo.GetAuditLogByID(ctx, id)
}
