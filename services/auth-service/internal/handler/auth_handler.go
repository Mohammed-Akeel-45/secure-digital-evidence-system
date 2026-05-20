package handlerauth

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/models"
	"auth-service-go/internal/store"
	"encoding/json"
	"log"

	"net/http"
)

type AuthHandler struct {
	Store *store.Storage
}

func (h *AuthHandler) AdminRegister(w http.ResponseWriter, r *http.Request) {
	var creds models.OraganisationRegistration

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		log.Println(err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check if the organisation already exists.
	if h.Store.CheckOrgExists(creds.OrganisationName) {
		http.Error(w, "Organisation already exists", http.StatusBadRequest)
		return
	}

	// Check if the admin email already exists.
	_, err := h.Store.GetUserByEmail(creds.AdminEmail)
	if err == nil {
		http.Error(w, "Email already registered", http.StatusBadRequest)
		return
	}

	// Hash the user password.
	hashedPassword, _ := auth.HashPassword(creds.AdminPassword)
	creds.AdminPassword = hashedPassword

	// insert new user into database.
	adminPublic, err := h.Store.RegisterOrgAndAdmin(&creds)
	if err != nil {
		log.Println(err)
		http.Error(w, "Could not register organisation", http.StatusInternalServerError)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(adminPublic.ID, adminPublic.Name, adminPublic.Email)
	if err != nil {
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
	var creds models.AdminLogin

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// get user with the email from the database.
	user, err := h.Store.GetUserByEmail(creds.AdminEmail)
	// return error if user doesn't already exists or password doesn't match the password.
	if err != nil || !auth.CheckPassword(creds.AdminPassword, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// check if user belongs to the organisation.
	org, err := h.Store.GetOrgByPublicID(user.OrgID)
	if err != nil {
		http.Error(w, "Failed to get organisation", http.StatusInternalServerError)
		return
	}

	if org.Name != creds.OrganisationName {
		http.Error(w, "User doesn't belong to the organisation", http.StatusUnauthorized)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(user.ID, user.Name, user.Email)
	if err != nil {
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

func (h *AuthHandler) GetServiceToken(w http.ResponseWriter, r *http.Request) {
	var creds models.Service

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	token, err := auth.GenerateServiceToken(creds)
	if err != nil {
		http.Error(w, "Failed to generate service token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"service_name": creds.ServiceName, "service_token": token})
}

func (h *AuthHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.UserID
	var creds models.User

	// Check if the user is an admin.
	if !h.Store.CheckUserIsOrgAdmin(userID) {
		http.Error(w, "User doesn't have admin privileges", http.StatusUnauthorized)
		return
	}

	// Get the user details from request body.
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Hash the user password.
	hashedPassword, err := auth.HashPassword(creds.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	creds.Password = hashedPassword

	// insert new user into database.
	createdUserID, err := h.Store.CreateUser(&creds)
	if err != nil {
		http.Error(w, "Could not create user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"user_id": createdUserID, "user_email": creds.Email})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var creds models.User

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// get user with the email from the database.
	user, err := h.Store.GetUserByEmail(creds.Email)
	// return error if user doesn't already exists or password doesn't match the password.
	if err != nil || !auth.CheckPassword(creds.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(user.ID, user.Name, user.Email)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"user_name": user.Name, "user_id": user.ID, "access_token": accToken})
}
