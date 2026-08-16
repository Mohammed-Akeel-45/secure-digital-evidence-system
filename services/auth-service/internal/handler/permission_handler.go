package handlerauth

import (
	"auth-service-go/internal/models"
	"encoding/json"
	"log/slog"
	"net/http"
)

func (h *AuthHandler) CheckPermissions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		slog.ErrorContext(ctx, "Failed to get claims from token")
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	tokenType := claims.TokenType

	if tokenType != "service" {
		slog.WarnContext(ctx, "Unauthorized client attempted to check permissions", "token_type", tokenType)
		http.Error(w, "Invalid token type", http.StatusUnauthorized)
		return
	}

	var permCheckRequest models.PermissionCheckRequest

	if err := json.NewDecoder(r.Body).Decode(&permCheckRequest); err != nil {
		slog.WarnContext(ctx, "Invalid permission check request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &permCheckRequest)
	if err != nil {
		slog.ErrorContext(ctx, "checkPermissions failed", "error", err)
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	permissionCheckResponse := &models.PermissionCheckResponse{Allowed: len(missingPermissions) == 0, MissingPermissions: missingPermissions}

	json.NewEncoder(w).Encode(permissionCheckResponse)
}

func (h *AuthHandler) GetAllPermissions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	permissions, err := h.Store.GetAllPermissions(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get all permissions from store", "error", err)
		http.Error(w, "Failed to get permissions", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(permissions)
}
