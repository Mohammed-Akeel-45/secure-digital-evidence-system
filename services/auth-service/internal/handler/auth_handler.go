package handlerauth

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/httpcalls"
	"auth-service-go/internal/models"
	"auth-service-go/internal/store"
	"context"
	"encoding/json"
	"fmt"
	"log"

	"net/http"

	"github.com/gorilla/mux"
)

type AuthHandler struct {
	Store      *store.Storage
	HTTPCaller *httpcalls.HTTPCaller
}

func (h *AuthHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var roleAssignment models.RoleAssignment
	if err := json.NewDecoder(r.Body).Decode(&roleAssignment); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_ASSIGN.String()},
		Scope:        roleAssignment.Scope,
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to assign a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, roleAssignment.Scope)
	if err != nil {
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.AssignRole(ctx, &roleAssignment, scopeID)
	if err != nil {
		http.Error(w, "Failed to assign role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) RevokeRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var roleRevoke models.RoleRevoke
	if err := json.NewDecoder(r.Body).Decode(&roleRevoke); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_REVOKE.String()},
		Scope:        roleRevoke.Scope,
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to revoke a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, roleRevoke.Scope)
	if err != nil {
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.RevokeRole(ctx, &roleRevoke, scopeID)
	if err != nil {
		http.Error(w, "Failed to revoke role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) DetachPermissionsFromRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var detachPermissions models.DetachPermissionsFromRole

	if err := json.NewDecoder(r.Body).Decode(&detachPermissions); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_EDIT.String()},
		Scope:        detachPermissions.Scope,
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to detach permissions from role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, detachPermissions.Scope)
	if err != nil {
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.DetachPermissionsFromRole(ctx, &detachPermissions, scopeID)
	if err != nil {
		http.Error(w, "Failed to detach permissions from role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) AttachPermissionsToRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject
	orgPublicID := claims.OrgID

	var attachPermissions models.AttachPermissionsToRole

	if err := json.NewDecoder(r.Body).Decode(&attachPermissions); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_EDIT.String()},
		Scope:        attachPermissions.Scope,
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to attach permissions to role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, attachPermissions.Scope)
	if err != nil {
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.AttachPermissionsToRole(ctx, orgPublicID, &attachPermissions, scopeID)
	if err != nil {
		http.Error(w, "Failed to attach permissions to role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) GetOrgRoles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	orgPublicID := claims.OrgID
	scopeType := r.URL.Query().Get("scope_type")

	roles, err := h.Store.GetOrgRoles(ctx, orgPublicID, scopeType)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to get roles", http.StatusInternalServerError)
		return
	}

	if scopeType == "CASE" && len(roles) > 0 {
		var internalIDs []int64
		for _, role := range roles {
			if role.ScopeID != "" {
				var id int64
				if _, err := fmt.Sscanf(role.ScopeID, "%d", &id); err == nil {
					internalIDs = append(internalIDs, id)
				}
			}
		}

		if len(internalIDs) > 0 {
			IDMap, err := h.HTTPCaller.ResolveCaseInternalIDsToPublicIDs(ctx, internalIDs)
			if err != nil {
				log.Printf("Failed to resolve case public IDs: %v", err)
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
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	roles, err := h.Store.GetUserRoles(ctx, userID)
	if err != nil {
		http.Error(w, "Failed to get roles", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(roles)
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
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermission) != 0 {
		http.Error(w, "User doesn't have permission to create a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, role.Scope)
	if err != nil {
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	// Check if the role already exists.
	exists, err := h.Store.CheckRoleExists(ctx, role.Name, role.Scope.Type, scopeID)
	if err != nil {
		http.Error(w, "Failed to check if role already exists", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, fmt.Sprintf("Role already exists for scope: %s", role.Scope.Type), http.StatusBadRequest)
		return
	}

	_, err = h.Store.CreateRole(ctx, claims.OrgID, role, scopeID)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to create role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *AuthHandler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userID := claims.Subject

	var roleDelete models.RoleDelete

	if err := json.NewDecoder(r.Body).Decode(&roleDelete); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if roleDelete.Name == "ORG_ADMIN" {
		http.Error(w, "Cannot delete ORG_ADMIN role", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.ROLE_DELETE.String()},
		Scope:        roleDelete.Scope,
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to delete a role", http.StatusUnauthorized)
		return
	}

	scopeID, err := h.resolveScopeID(ctx, roleDelete.Scope)
	if err != nil {
		http.Error(w, "Failed to resolve scope ID", http.StatusInternalServerError)
		return
	}

	err = h.Store.DeleteRole(ctx, &roleDelete, scopeID)
	if err != nil {
		http.Error(w, "Failed to delete role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
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

	var permCheckRequest models.PermissionCheckRequest

	if err := json.NewDecoder(r.Body).Decode(&permCheckRequest); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	missingPermissions, err := h.checkPermissions(ctx, &permCheckRequest)
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	permissionCheckResponse := &models.PermissionCheckResponse{Allowed: len(missingPermissions) == 0, MissingPermissions: missingPermissions}

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
	if err != nil || !h.Store.CheckUserIsOrgAdmin(ctx, creds.AdminEmail) || !auth.CheckPassword(creds.AdminPassword, user.Password) {
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

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.USER_CREATE.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to create a user", http.StatusUnauthorized)
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

	if creds.Role != "" {
		scopeID, err := h.resolveScopeID(ctx, models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		})
		if err != nil {
			log.Printf("Failed to resolve org scope ID for new user %s: %v", createdUserID, err)
		} else {
			err = h.Store.AssignRole(ctx, &models.RoleAssignment{
				Names:              []string{creds.Role},
				TargetUserPublicID: createdUserID,
				Scope: models.Scope{
					Type:     "ORG",
					PublicID: claims.OrgID,
				},
			}, scopeID)
			if err != nil {
				log.Printf("Failed to assign role %s to new user %s: %v", creds.Role, createdUserID, err)
			}
		}
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

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.USER_VIEW.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to view users", http.StatusUnauthorized)
		return
	}

	org, err := h.Store.GetOrgByPublicID(ctx, claims.OrgID)
	if err != nil {
		http.Error(w, "Token contains invalid orgID", http.StatusBadRequest)
	}

	users, err := h.Store.GetOrgUsers(ctx, org.ID)
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

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.DEPARTMENT_CREATE.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to create a department", http.StatusUnauthorized)
		return
	}

	var department models.DepartmentRegistration

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// If OrgID isn't sent in the body use the one available in claims.
	department.OrgID = claims.OrgID

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

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.DEPARTMENT_VIEW.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to view departments", http.StatusUnauthorized)
		return
	}

	org, err := h.Store.GetOrgByPublicID(ctx, claims.OrgID)
	if err != nil {
		http.Error(w, "Token contains invalid orgID", http.StatusBadRequest)
	}

	departments, err := h.Store.GetAllOrgDepartments(ctx, org.ID)
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

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.USER_EDIT.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to edit user department", http.StatusUnauthorized)
		return
	}

	var department models.UpdateUserDepartment

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err = h.Store.UpdateUserDepartment(ctx, department.UserID, department.ID)
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

	missingPermissions, err := h.checkPermissions(ctx, &models.PermissionCheckRequest{
		UserPublicID: userID,
		Permissions:  []string{auth.DEPARTMENT_DELETE.String()},
		Scope: models.Scope{
			Type:     "ORG",
			PublicID: claims.OrgID,
		},
	})
	if err != nil {
		http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
		return
	}
	if len(missingPermissions) != 0 {
		http.Error(w, "User doesn't have permission to delete a department", http.StatusUnauthorized)
		return
	}

	var department models.DeleteDepartment

	if err := json.NewDecoder(r.Body).Decode(&department); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	tx, deptID, orgID, err := h.Store.DeleteDepartmentStart(ctx, department.ID)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to start department deletion", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Get all the cases in the department from case-service.
	cases, err := h.HTTPCaller.GetDepartmentCases(ctx, orgID, deptID)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to fetch department cases", http.StatusInternalServerError)
		return
	}

	// Delete roles for the cases and department.
	err = h.Store.DeleteDepartmentRoles(ctx, tx, deptID)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to delete department roles", http.StatusInternalServerError)
		return
	}

	// Delete all roles for the cases that belong to the department
	err = h.Store.DeleteCaseRoles(ctx, tx, cases)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to delete department case roles", http.StatusInternalServerError)
		return
	}

	// Delete all cases in the department via case-service.
	err = h.HTTPCaller.DeleteDepartmentCases(ctx, orgID, deptID)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to delete department cases from case service", http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to commit department deletion", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) GetAllPermissions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	permissions, err := h.Store.GetAllPermissions(ctx)
	if err != nil {
		http.Error(w, "Failed to get permissions", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(permissions)
}

func (h *AuthHandler) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	roleName := vars["role_name"]

	permissions, err := h.Store.GetRolePermissions(ctx, roleName)
	if err != nil {
		http.Error(w, "Failed to get permissions", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(permissions)
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
