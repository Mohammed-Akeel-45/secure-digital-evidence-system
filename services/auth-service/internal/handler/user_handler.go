package handlerauth

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/models"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"
)

func (h *AuthHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject
	var creds models.User

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.USER_CREATE.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for CreateUser", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to create user", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to create a user", http.StatusUnauthorized)
		return
	}

	// Get the user details from request body.
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		slog.WarnContext(ctx, "Invalid create user request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	creds.OrgID = claims.OrgID

	// Hash the user password.
	hashedPassword, err := auth.HashPassword(creds.Password)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to hash user password", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	creds.Password = hashedPassword

	// insert new user into database.
	createdUserID, err := h.Store.CreateUser(ctx, &creds)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to create user in store", "error", err, "email", creds.Email)
		http.Error(w, "Could not create user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"user_id": createdUserID, "user_email": creds.Email})
}

func (h *AuthHandler) GetOrgUsers(w http.ResponseWriter, r *http.Request) {
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
		Permissions:  []string{auth.USER_VIEW.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for GetOrgUsers", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to view users", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to view users", http.StatusUnauthorized)
		return
	}

	org, err := h.Store.GetOrgByPublicID(ctx, claims.OrgID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve org public ID in GetOrgUsers", "error", err, "org_public_id", claims.OrgID)
		http.Error(w, "Token contains invalid orgID", http.StatusBadRequest)
		return
	}

	users, err := h.Store.GetOrgUsers(ctx, org.ID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get organisation users from store", "error", err, "org_id", org.ID)
		http.Error(w, "Failed to get organisation users", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(users)
}

func (h *AuthHandler) GetUserDetails(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	userPublicID := vars["user_id"]

	user, err := h.Store.GetUserDetailsByPublicID(ctx, userPublicID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get user details by public ID", "error", err, "public_id", userPublicID)
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(user)
}

func (h *AuthHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject
	vars := mux.Vars(r)
	targetUserPublicID := vars["user_id"]

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.USER_DELETE.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for DeleteUser", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to delete user", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to delete a user", http.StatusForbidden)
		return
	}

	err = h.Store.DeleteUser(ctx, targetUserPublicID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to delete user in store", "error", err, "target_user_public_id", targetUserPublicID)
		http.Error(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) UpdateUserDepartment(w http.ResponseWriter, r *http.Request) {
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
		Permissions:  []string{auth.USER_EDIT.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		slog.ErrorContext(ctx, "Permission check failed for UpdateUserDepartment", "error", err, "user_id", userID)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		slog.WarnContext(ctx, "User not authorized to edit user department", "user_id", userID, "missing", missingPermissions)
		http.Error(w, "User doesn't have permission to edit user department", http.StatusUnauthorized)
		return
	}

	var department models.UpdateUserDepartment

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		slog.WarnContext(ctx, "Invalid update user department request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err = h.Store.UpdateUserDepartment(ctx, department.UserID, department.ID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to update user department in store", "error", err, "user_public_id", department.UserID, "dept_public_id", department.ID)
		http.Error(w, "Failed to update user department", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) ResolveUserPublicIDToInternalID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	publicID := vars["public_id"]

	userID, err := h.Store.ResolveUserPublicIDToInternalID(ctx, publicID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to resolve user public ID to internal ID", "error", err, "public_id", publicID)
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]int64{"id": userID})
}
