package handlerauth

import (
	"auth-service-go/internal/httpcalls"
	"auth-service-go/internal/models"
	"auth-service-go/internal/store"
	"context"
	"fmt"
)

type AuthHandler struct {
	Store      *store.Storage
	HTTPCaller *httpcalls.HTTPCaller
}

func (h *AuthHandler) resolveScopeID(ctx context.Context, scope models.Scope) (int64, error) {
	switch scope.Type {
	case "ORG":
		org, err := h.Store.GetOrgByPublicID(ctx, scope.PublicID)
		if err != nil {
			return 0, err
		}
		return org.ID, nil
	case "DEPARTMENT":
		department, err := h.Store.ResolveDepartmentByPublicID(ctx, scope.PublicID)
		if err != nil {
			return 0, err
		}
		return department.ID, nil
	case "CASE":
		caseID, err := h.HTTPCaller.ResolveCasePublicIDToInternalID(ctx, scope.PublicID)
		if err != nil {
			return 0, err
		}
		return caseID, nil
	default:
		return 0, fmt.Errorf("invalid scope type: %s", scope.Type)
	}
}

func (h *AuthHandler) checkPermissions(ctx context.Context, req *models.PermissionCheckRequest) ([]string, error) {
	var caseDetails *models.CaseDetails
	if req.Scope.Type == "CASE" {
		var err error
		caseDetails, err = h.HTTPCaller.GetCaseDetails(ctx, req.Scope.PublicID)
		if err != nil {
			return nil, err
		}
	}
	return h.Store.CheckPermissions(ctx, req, caseDetails)
}
