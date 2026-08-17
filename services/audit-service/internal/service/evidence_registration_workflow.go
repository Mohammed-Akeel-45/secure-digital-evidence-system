package service

import (
	"audit-service/internal/repository"
	"audit-service/internal/store"
	"context"
)

type EvidenceRegistrationWorkflow struct {
	store        *store.Storage
	evidenceRepo repository.EvidenceRepo
	custodyRepo  repository.CustodyRepo
	auditRepo    repository.AuditRepo
	actionRepo   repository.ActionRepo
}

func NewEvidenceRegistrationWorkflow(
	store *store.Storage,
	evidenceRepo repository.EvidenceRepo,
	custodyRepo repository.CustodyRepo,
	auditRepo repository.AuditRepo,
	actionRepo repository.ActionRepo,
) *EvidenceRegistrationWorkflow {
	return &EvidenceRegistrationWorkflow{store, evidenceRepo, custodyRepo, auditRepo, actionRepo}
}

func (ev *EvidenceRegistrationWorkflow) RegisterEvidence(ctx context.Context, evidence store.EvidenceRegistrationDetails) error {
	return ev.store.WithinTransactionReadCommitted(ctx, func(txCtx context.Context) error {
		// Resolve the action name to action ID
		actionID, err := ev.actionRepo.GetActionIDByName(txCtx, evidence.Action)
		if err != nil {
			return err
		}

		// Pass txCtx instead of ctx to ensure that query is executed within the transaction.
		if err := ev.evidenceRepo.InsertEvidenceHash(txCtx, evidence.ToEvidenceDetails()); err != nil {
			return err
		}

		if err := ev.custodyRepo.InsertCustodyLog(txCtx, evidence.ToCustodyLog(actionID)); err != nil {
			return err
		}

		if err := ev.auditRepo.InsertAuditLog(txCtx, evidence.ToAuditLog(actionID)); err != nil {
			return err
		}

		return nil // Everything commits successfully.
	})
}
