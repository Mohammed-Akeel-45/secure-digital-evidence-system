package handlerauth

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/models"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"
)

func (h *AuthHandler) AdminRegister(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var creds models.OraganisationRegistration

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		slog.WarnContext(ctx, "Invalid admin register request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check if the organisation already exists.
	if h.Store.CheckOrgExists(ctx, creds.OrganisationName) {
		slog.WarnContext(ctx, "Attempted to register existing organisation name", "org_name", creds.OrganisationName)
		http.Error(w, "Organisation already exists", http.StatusBadRequest)
		return
	}

	// Check if the admin email already exists.
	_, err := h.Store.GetUserByEmail(ctx, creds.AdminEmail)
	if err == nil {
		slog.WarnContext(ctx, "Attempted to register existing admin email", "email", creds.AdminEmail)
		http.Error(w, "Email already registered", http.StatusBadRequest)
		return
	}

	// Hash the user password.
	hashedPassword, _ := auth.HashPassword(creds.AdminPassword)
	creds.AdminPassword = hashedPassword

	// insert new user into database.
	adminPublic, err := h.Store.RegisterOrgAndAdmin(ctx, &creds)
	if err != nil {
		slog.ErrorContext(ctx, "Could not register organisation and admin", "error", err, "org_name", creds.OrganisationName, "admin_email", creds.AdminEmail)
		http.Error(w, "Could not register organisation", http.StatusInternalServerError)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(adminPublic.OrgID, adminPublic.ID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to generate token for admin registration", "error", err, "admin_id", adminPublic.ID)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"user_id":      adminPublic.ID,
		"user_name":    adminPublic.Name,
		"user_email":   adminPublic.Email,
		"org_id":       adminPublic.OrgID,
		"org_name":     adminPublic.OrgName,
		"access_token": accToken,
	})
}

func (h *AuthHandler) AdminLogin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var creds models.AdminLogin

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		slog.WarnContext(ctx, "Invalid admin login request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// get user with the email from the database.
	user, err := h.Store.GetUserByEmail(ctx, creds.AdminEmail)
	// return error if user doesn't already exists or password doesn't match the password.
	if err != nil || !h.Store.CheckUserIsOrgAdmin(ctx, creds.AdminEmail) || !auth.CheckPassword(creds.AdminPassword, user.Password) {
		slog.WarnContext(ctx, "Failed admin login attempt", "email", creds.AdminEmail)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(user.OrgID, user.ID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to generate token for admin login", "error", err, "admin_id", user.ID)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"user_name":    user.Name,
		"user_email":   user.Email,
		"user_id":      user.ID,
		"org_id":       user.OrgID,
		"org_name":     user.OrgName,
		"access_token": accToken,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var creds models.User

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		slog.WarnContext(ctx, "Invalid login request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// get user with the email from the database.
	user, err := h.Store.GetUserByEmail(ctx, creds.Email)
	// return error if user doesn't already exists or password doesn't match the password.
	if err != nil || !auth.CheckPassword(creds.Password, user.Password) {
		slog.WarnContext(ctx, "Failed login attempt", "email", creds.Email)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(user.OrgID, user.ID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to generate token for login", "error", err, "user_id", user.ID)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"user_name": user.Name, "user_id": user.ID, "access_token": accToken})
}

func (h *AuthHandler) GetServiceToken(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var creds models.Service

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		slog.WarnContext(ctx, "Invalid get service token request body", "error", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if creds.ServiceName == "" || creds.ServiceSecret == "" {
		slog.WarnContext(ctx, "Missing service_name or service_secret in request")
		http.Error(w, "service_name and service_secret are required", http.StatusBadRequest)
		return
	}

	secretEnvName := "SERVICE_SECRET_" + strings.ToUpper(strings.ReplaceAll(creds.ServiceName, "-", "_"))
	expectedSecret := os.Getenv(secretEnvName)
	if expectedSecret == "" {
		expectedSecret = os.Getenv("SERVICE_SECRET")
	}

	if expectedSecret == "" || creds.ServiceSecret != expectedSecret {
		slog.WarnContext(ctx, "Unauthorized service token request: secret mismatch", "service_name", creds.ServiceName)
		http.Error(w, "Invalid service credentials", http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateServiceToken(creds)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to generate service token", "error", err, "service_name", creds.ServiceName)
		http.Error(w, "Failed to generate service token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"service_name":  creds.ServiceName,
		"service_token": token,
		"expires_in":    3600,
	})
}
