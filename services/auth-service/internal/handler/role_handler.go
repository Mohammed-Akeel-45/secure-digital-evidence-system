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

func (h *AuthHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var roleAssignment models.RoleAssignment
	if err := json.NewDecoder(r.Body).Decode(&roleAssignment); err != nil {
		slog.WarnContext(ctx, "Invalid role assignment request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_ASSIGN.String()},
		Scope:        roleAssignment.Scope,
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for AssignRole", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to assign role", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to assign a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, roleAssignment.Scope)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve scope ID in AssignRole", "error", err, "scope_type", roleAssignment.Scope.Type, "public_id", roleAssignment.Scope.PublicID)
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.AssignRole(ctx, &roleAssignment, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to assign role in store", "error", err, "scope_id", scopeID)
		http.Error(w, "Failed to assign role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) RevokeRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var roleRevoke models.RoleRevoke
	if err := json.NewDecoder(r.Body).Decode(&roleRevoke); err != nil {
		slog.WarnContext(ctx, "Invalid role revoke request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_REVOKE.String()},
		Scope:        roleRevoke.Scope,
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for RevokeRole", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to revoke role", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to revoke a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, roleRevoke.Scope)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve scope ID in RevokeRole", "error", err, "scope_type", roleRevoke.Scope.Type, "public_id", roleRevoke.Scope.PublicID)
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.RevokeRole(ctx, &roleRevoke, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to revoke role in store", "error", err, "scope_id", scopeID)
		http.Error(w, "Failed to revoke role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) DetachPermissionsFromRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var detachPermissions models.DetachPermissionsFromRole

	if err := json.NewDecoder(r.Body).Decode(&detachPermissions); err != nil {
		slog.WarnContext(ctx, "Invalid detach permissions request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_EDIT.String()},
		Scope:        detachPermissions.Scope,
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for DetachPermissionsFromRole", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to detach permissions", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to detach permissions from role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, detachPermissions.Scope)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve scope ID in DetachPermissions", "error", err, "scope_type", detachPermissions.Scope.Type, "public_id", detachPermissions.Scope.PublicID)
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.DetachPermissionsFromRole(ctx, &detachPermissions, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to detach permissions in store", "error", err, "scope_id", scopeID)
		http.Error(w, "Failed to detach permissions from role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) AttachPermissionsToRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject
	orgPublicID := claims.OrgID

	var attachPermissions models.AttachPermissionsToRole

	if err := json.NewDecoder(r.Body).Decode(&attachPermissions); err != nil {
		slog.WarnContext(ctx, "Invalid attach permissions request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_EDIT.String()},
		Scope:        attachPermissions.Scope,
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for AttachPermissionsToRole", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to attach permissions", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to attach permissions to role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, attachPermissions.Scope)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve scope ID in AttachPermissions", "error", err, "scope_type", attachPermissions.Scope.Type, "public_id", attachPermissions.Scope.PublicID)
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.AttachPermissionsToRole(ctx, orgPublicID, &attachPermissions, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to attach permissions in store", "error", err, "scope_id", scopeID)
		http.Error(w, "Failed to attach permissions to role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) GetOrgRoles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	orgPublicID := claims.OrgID
	scopeType := r.URL.Query().Get("scope_type")

	roles, err := h.Store.GetOrgRoles(ctx, orgPublicID, scopeType)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get org roles from store", "error", err, "org_id", orgPublicID, "scope_type", scopeType)
		http.Error(w, "Failed to get roles", http.StatusInternalServerError)
		return
	}

	// If roles are requested in CASE scope or "" scope meaning all scopes then resolve cases internal ids to public ids.
	if (scopeType == "CASE" || scopeType == "") && len(roles) > 0 {
		var internalIDs []int64
		for _, role := range roles {
			if role.ScopeType == "CASE" && role.ScopeID != "" {
				var id int64
				if _, err := fmt.Sscanf(role.ScopeID, "%d", &id); err == nil {
					internalIDs = append(internalIDs, id)
				}
			}
		}

		if len(internalIDs) > 0 {
			IDMap, err := h.HTTPCaller.ResolveCaseInternalIDsToPublicIDs(ctx, internalIDs)
			if err != nil {
				slog.ErrorContext(ctx, "Failed to resolve case public IDs", "error", err)
			} else {
				// Update ScopeID and ScopeName on roles
				for i := range roles {
					var id int64
					if _, err := fmt.Sscanf(roles[i].ScopeID, "%d", &id); err == nil {
						if pair, found := IDMap[id]; found {
							roles[i].ScopeID = pair.PublicID
							roles[i].ScopeName = pair.Name
						}
					}
				}
			}
		}
	}

	json.NewEncoder(w).Encode(roles)
}

func (h *AuthHandler) GetUserRoles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	userPublicID := vars["user_id"]

	userID, err := h.Store.ResolveUserPublicIDToInternalID(ctx, userPublicID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve user public ID to internal ID", "error", err, "public_id", userPublicID)
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	roles, err := h.Store.GetUserRoles(ctx, userID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get user roles from store", "error", err, "user_id", userID)
		http.Error(w, "Failed to get roles", http.StatusInternalServerError)
		return
	}

	if len(roles) > 0 {
		var caseInternalIDs []int64
		for _, role := range roles {
			if role.ScopeType == "CASE" && role.ScopeID != "" {
				var id int64
				if _, err := fmt.Sscanf(role.ScopeID, "%d", &id); err == nil {
					caseInternalIDs = append(caseInternalIDs, id)
				}
			}
		}

		if len(caseInternalIDs) > 0 {
			IDMap, err := h.HTTPCaller.ResolveCaseInternalIDsToPublicIDs(ctx, caseInternalIDs)
			if err != nil {
				slog.ErrorContext(ctx, "Failed to resolve case public IDs for user roles", "error", err)
			} else {
				// Update ScopeID and ScopeName on roles
				for i := range roles {
					if roles[i].ScopeType == "CASE" {
						var id int64
						if _, err := fmt.Sscanf(roles[i].ScopeID, "%d", &id); err == nil {
							if pair, found := IDMap[id]; found {
								roles[i].ScopeID = pair.PublicID
								roles[i].ScopeName = pair.Name
							}
						}
					}
				}
			}
		}
	}

	json.NewEncoder(w).Encode(roles)
}

func (h *AuthHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var role *models.RoleCreate

	if err := json.NewDecoder(r.Body).Decode(&role); err != nil {
		slog.WarnContext(ctx, "Invalid create role request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// If the scope is ORG, set the scope_id to the orgID.
	if role.Scope.Type == "ORG" {
		role.Scope.PublicID = claims.OrgID
	}

	// Check if the user has permission to create a role.
	permissionCheckRequest := &models.PermissionCheckRequest{
		UserPublicID: userID,
		Scope:        role.Scope,
		Permissions:  []string{auth.ROLE_CREATE.String()},
	}

	missingPermission, err := h.checkPermissions(ctx, permissionCheckRequest)
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for CreateRole", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermission) != 0 {
		slog.WarnContext(ctx, "User not authorized to create role", "user_id", userID, "missing", missingPermission)
		http.Error(w, "User doesn't have permission to create a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, role.Scope)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve scope ID in CreateRole", "error", err, "scope_type", role.Scope.Type, "public_id", role.Scope.PublicID)
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	// Check if the role already exists.
	exists, err := h.Store.CheckRoleExists(ctx, role.Name, role.Scope.Type, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to check if role exists in store", "error", err, "role_name", role.Name, "scope_id", scopeID)
		http.Error(w, "Failed to check if role already exists", http.StatusInternalServerError)
		return
	}
	if exists {
		slog.WarnContext(ctx, "Role already exists for scope", "role_name", role.Name, "scope_type", role.Scope.Type)
		http.Error(w, fmt.Sprintf("Role already exists for scope: %s", role.Scope.Type), http.StatusBadRequest)
		return
	}

	_, err = h.Store.CreateRole(ctx, claims.OrgID, role, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to create role in store", "error", err, "role_name", role.Name, "scope_id", scopeID)
		http.Error(w, "Failed to create role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *AuthHandler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var roleDelete models.RoleDelete

	if err := json.NewDecoder(r.Body).Decode(&roleDelete); err != nil {
		slog.WarnContext(ctx, "Invalid delete role request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if roleDelete.Name == "ORG_ADMIN" {
		slog.WarnContext(ctx, "Attempted to delete protected ORG_ADMIN role", "user_id", userID)
		http.Error(w, "Cannot delete ORG_ADMIN role", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_DELETE.String()},
		Scope:        roleDelete.Scope,
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for DeleteRole", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to delete role", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to delete a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, roleDelete.Scope)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve scope ID in DeleteRole", "error", err, "scope_type", roleDelete.Scope.Type, "public_id", roleDelete.Scope.PublicID)
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.DeleteRole(ctx, &roleDelete, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to delete role in store", "error", err, "role_name", roleDelete.Name, "scope_id", scopeID)
		http.Error(w, "Failed to delete role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	roleName := vars["role_name"]

	scopeType := r.URL.Query().Get("scope_type")
	scopePublicID := r.URL.Query().Get("scope_id")

	var scopeID int64
	var err error
	if scopeType != "" && scopePublicID != "" {
		scopeID, err = h.resolveScopeID(ctx, models.Scope{Type: scopeType, PublicID: scopePublicID})
		if err != nil {
			slog.ErrorContext(ctx, "Failed to resolve scope ID in GetRolePermissions", "error", err, "scope_type", scopeType, "scope_id", scopePublicID)
			http.Error(w, "Failed to resolve scope ID", http.StatusBadRequest)
			return
		}
	}

	permissions, err := h.Store.GetRolePermissions(ctx, roleName, scopeType, scopeID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get role permissions from store", "error", err, "role_name", roleName, "scope_type", scopeType, "scope_id", scopeID)
		http.Error(w, "Failed to get permissions", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(permissions)
}
