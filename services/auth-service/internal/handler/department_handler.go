package handlerauth

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/models"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"
)

func (h *AuthHandler) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.DEPARTMENT_CREATE.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for CreateDepartment", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to create department", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to create a department", http.StatusUnauthorized)
		return
	}

	var department models.DepartmentRegistration

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		slog.WarnContext(ctx, "Invalid create department request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// If OrgID isn't sent in the body use the one available in claims.
	department.OrgID = claims.OrgID

	departPublicID, err := h.Store.CreateDepartment(ctx, &department)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to create department in store", "error", err, "name", department.Name)
		http.Error(w, "Failed to create department", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"department_id": departPublicID, "department_name": department.Name})
}

func (h *AuthHandler) GetAllOrgDepartments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.DEPARTMENT_VIEW.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for GetAllOrgDepartments", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to view departments", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to view departments", http.StatusUnauthorized)
		return
	}

	org, err := h.Store.GetOrgByPublicID(ctx, claims.OrgID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve org public ID in GetAllOrgDepartments", "error", err, "org_public_id", claims.OrgID)
		http.Error(w, "Token contains invalid orgID", http.StatusBadRequest)
		return
	}

	departments, err := h.Store.GetAllOrgDepartments(ctx, org.ID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get organisation departments from store", "error", err, "org_id", org.ID)
		http.Error(w, "Failed to get organisation departments", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(departments)
}

func (h *AuthHandler) DeleteDepartment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.DEPARTMENT_DELETE.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for DeleteDepartment", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to delete department", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to delete a department", http.StatusUnauthorized)
		return
	}

	var department models.DeleteDepartment

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		slog.WarnContext(ctx, "Invalid delete department request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	tx, deptID, orgID, err := h.Store.DeleteDepartmentStart(ctx, department.ID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to start department deletion in store", "error", err, "dept_public_id", department.ID)
		http.Error(w, "Failed to start department deletion", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	err = h.Store.ClearDepartmentUsers(ctx, tx, deptID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to clear department from users", "error", err, "dept_id", deptID)
		http.Error(w, "Failed to clear department users", http.StatusInternalServerError)
		return
	}

	// Get all the cases in the department from case-service.
	cases, err := h.HTTPCaller.GetDepartmentCases(ctx, orgID, deptID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to fetch department cases via HTTP", "error", err, "org_id", orgID, "dept_id", deptID)
		http.Error(w, "Failed to fetch department cases", http.StatusInternalServerError)
		return
	}

	// Delete roles for the cases and department.
	err = h.Store.DeleteDepartmentRoles(ctx, tx, deptID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to delete department roles in store", "error", err, "dept_id", deptID)
		http.Error(w, "Failed to delete department roles", http.StatusInternalServerError)
		return
	}

	// Delete all roles for the cases that belong to the department
	err = h.Store.DeleteCaseRoles(ctx, tx, cases)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to delete department case roles in store", "error", err, "case_ids", cases)
		http.Error(w, "Failed to delete department case roles", http.StatusInternalServerError)
		return
	}

	// Delete all cases in the department via case-service.
	err = h.HTTPCaller.DeleteDepartmentCases(ctx, orgID, deptID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to delete department cases via HTTP", "error", err, "org_id", orgID, "dept_id", deptID)
		http.Error(w, "Failed to delete department cases from case service", http.StatusInternalServerError)
		return
	}

	err = h.Store.DeleteDepartment(ctx, tx, deptID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to delete department", "error", err, "dept_id", deptID)
		http.Error(w, "Failed to delete department", http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to commit department deletion transaction", "error", err)
		http.Error(w, "Failed to commit department deletion", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) ResolveDepartmentByPublicID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	publicID := vars["public_id"]

	department, err := h.Store.ResolveDepartmentByPublicID(ctx, publicID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve department by public ID", "error", err, "public_id", publicID)
		http.Error(w, "Failed to get department", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]int64{"id": department.ID})
}

func (h *AuthHandler) ResolveDepartmentInternalIDToPublicID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	internalIDStr := vars["internal_id"]

	var internalID int64
	_, err := fmt.Sscanf(internalIDStr, "%d", &internalID)
	if err != nil {
		slog.WarnContext(ctx, "Invalid department internal ID", "error", err, "internal_id", internalIDStr)
		http.Error(w, "Invalid internal ID", http.StatusBadRequest)
		return
	}

	publicID, err := h.Store.ResolveDepartmentInternalIDToPublicID(ctx, internalID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve department internal ID to public ID", "error", err, "internal_id", internalID)
		http.Error(w, "Failed to resolve department", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"public_id": publicID})
}
