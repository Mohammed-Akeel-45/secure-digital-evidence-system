package handlerauth

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/models"
	"auth-service-go/internal/store"
	"encoding/json"
	"log"

	"net/http"

	"github.com/gorilla/mux"
)

type AuthHandler struct {
	Store *store.Storage
}

func (h *AuthHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
}

func (h *AuthHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var role *models.RoleCreate

	if err := json.NewDecoder(r.Body).Decode(&role); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check if the user is an has permission to create a role.
	permissionCheckRequest := &models.PermissionCheckRequest{
		UserPublicID: userID,
		Scope:        role.Scope,
		Permissions:  []string{"CREATE_ROLE"},
	}

	allowed, err := h.Store.CheckPermissions(ctx, permissionCheckRequest)
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
	}
	if !allowed {
		http.Error(w, "User doesn't have permission to create a role", http.StatusUnauthorized)
		return
	}

	// Check if the role already exists.
	if h.Store.CheckRoleExists(ctx, role.Name) {
		http.Error(w, "Role already exists", http.StatusBadRequest)
		return
	}

	err = h.Store.CreateRole(ctx, role)
	if err != nil {
		http.Error(w, "Failed to create role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *AuthHandler) CheckPermissions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	tokenType := claims.TokenType

	if tokenType != "service" {
		http.Error(w, "Invalid token type", http.StatusUnauthorized)
		return
	}

	var permCheckRequest *models.PermissionCheckRequest

	if err := json.NewDecoder(r.Body).Decode(permCheckRequest); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	allowed, err := h.Store.CheckPermissions(ctx, permCheckRequest)
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	permissionCheckResponse := &models.PermissionCheckResponse{Allowed: allowed}

	json.NewEncoder(w).Encode(permissionCheckResponse)
}

func (h *AuthHandler) ResolveUserPublicIDToInternalID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	publicID := vars["public_id"]

	userID, err := h.Store.ResolveUserPublicIDToInternalID(ctx, publicID)
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]int64{"id": userID})
}

func (h *AuthHandler) ResolveOrgByPublicID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	publicID := vars["public_id"]

	org, err := h.Store.GetOrgByPublicID(ctx, publicID)
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to get organisation", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]int64{"id": org.ID})
}

func (h *AuthHandler) ResolveDepartmentByPublicID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	publicID := vars["public_id"]

	department, err := h.Store.ResolveDepartmentByPublicID(ctx, publicID)
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to get department", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]int64{"id": department.ID})
}

func (h *AuthHandler) AdminRegister(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var creds models.OraganisationRegistration

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		log.Println(err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check if the organisation already exists.
	if h.Store.CheckOrgExists(ctx, creds.OrganisationName) {
		http.Error(w, "Organisation already exists", http.StatusBadRequest)
		return
	}

	// Check if the admin email already exists.
	_, err := h.Store.GetUserByEmail(ctx, creds.AdminEmail)
	if err == nil {
		http.Error(w, "Email already registered", http.StatusBadRequest)
		return
	}

	// Hash the user password.
	hashedPassword, _ := auth.HashPassword(creds.AdminPassword)
	creds.AdminPassword = hashedPassword

	// insert new user into database.
	adminPublic, err := h.Store.RegisterOrgAndAdmin(ctx, &creds)
	if err != nil {
		log.Println(err)
		http.Error(w, "Could not register organisation", http.StatusInternalServerError)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(adminPublic.OrgID, adminPublic.ID)
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
	ctx := r.Context()
	var creds models.AdminLogin

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// get user with the email from the database.
	user, err := h.Store.GetUserByEmail(ctx, creds.AdminEmail)
	// return error if user doesn't already exists or password doesn't match the password.
	if err != nil || !user.IsOrgAdmin || !auth.CheckPassword(creds.AdminPassword, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(user.OrgID, user.ID)
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
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject
	var creds models.User

	// Check if the user is an admin.
	if !h.Store.CheckUserIsOrgAdmin(ctx, userID) {
		http.Error(w, "User doesn't have admin privileges", http.StatusUnauthorized)
		return
	}

	// Get the user details from request body.
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	creds.OrgID = claims.OrgID

	// Hash the user password.
	hashedPassword, err := auth.HashPassword(creds.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	creds.Password = hashedPassword

	// insert new user into database.
	createdUserID, err := h.Store.CreateUser(ctx, &creds)
	if err != nil {
		http.Error(w, "Could not create user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"user_id": createdUserID, "user_email": creds.Email})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var creds models.User

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// get user with the email from the database.
	user, err := h.Store.GetUserByEmail(ctx, creds.Email)
	// return error if user doesn't already exists or password doesn't match the password.
	if err != nil || !auth.CheckPassword(creds.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// generate the access token. Valid for 1 hour.
	accToken, err := auth.GenerateToken(user.OrgID, user.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"user_name": user.Name, "user_id": user.ID, "access_token": accToken})
}

func (h *AuthHandler) GetOrgUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	// Check if the user is an admin.
	if !h.Store.CheckUserIsOrgAdmin(ctx, userID) {
		http.Error(w, "User doesn't have admin privileges", http.StatusUnauthorized)
		return
	}

	orgID := claims.OrgID
	users, err := h.Store.GetOrgUsers(ctx, orgID)
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to get organisation users", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(users)
}

func (h *AuthHandler) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	// Check if the user is an admin.
	if !h.Store.CheckUserIsOrgAdmin(ctx, userID) {
		http.Error(w, "User doesn't have admin privileges", http.StatusUnauthorized)
		return
	}

	var department models.DepartmentRegistration

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	departPublicID, err := h.Store.CreateDepartment(ctx, &department)
	if err != nil {
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
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	// Check if the user is an admin.
	if !h.Store.CheckUserIsOrgAdmin(ctx, userID) {
		http.Error(w, "User doesn't have admin privileges", http.StatusUnauthorized)
		return
	}

	orgID := claims.OrgID

	departments, err := h.Store.GetAllOrgDepartments(ctx, orgID)
	if err != nil {
		http.Error(w, "Failed to get organisation departments", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(departments)
}

func (h *AuthHandler) UpdateUserDepartment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	// Check if the user is an admin.
	if !h.Store.CheckUserIsOrgAdmin(ctx, userID) {
		http.Error(w, "User doesn't have admin privileges", http.StatusUnauthorized)
		return
	}

	var department models.UpdateUserDepartment

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err := h.Store.UpdateUserDepartment(ctx, department.UserID, department.ID)
	if err != nil {
		http.Error(w, "Failed to update user department", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) DeleteDepartment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	// Check if the user is an admin.
	if !h.Store.CheckUserIsOrgAdmin(ctx, userID) {
		http.Error(w, "User doesn't have admin privileges", http.StatusUnauthorized)
		return
	}

	var department models.DeleteDepartment

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err := h.Store.DeleteDepartment(ctx, department.ID)
	if err != nil {
		http.Error(w, "Failed to delete department", http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
}
