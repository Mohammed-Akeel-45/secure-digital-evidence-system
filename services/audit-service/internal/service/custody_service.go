package service

import (
	"audit-service/internal/repository"
	"audit-service/internal/store"
	"context"
)

type CustodyService interface {
	GetCustodyLogs(ctx context.Context, evidenceID string, caseID string, limit int, offset int) ([]store.CustodyLogDTO, error)
	GetCustodyLogByID(ctx context.Context, id string) (*store.CustodyLogDTO, error)
}

type custodyService struct {
	custodyRepo repository.CustodyRepo
}

func NewCustodyService(custodyRepo repository.CustodyRepo) CustodyService {
	return &custodyService{custodyRepo: custodyRepo}
}

func (s *custodyService) GetCustodyLogs(ctx context.Context, evidenceID string, caseID string, limit int, offset int) ([]store.CustodyLogDTO, error) {
	return s.custodyRepo.ListCustodyLogs(ctx, evidenceID, caseID, limit, offset)
}

func (s *custodyService) GetCustodyLogByID(ctx context.Context, id string) (*store.CustodyLogDTO, error) {
	return s.custodyRepo.GetCustodyLogByID(ctx, id)
}
