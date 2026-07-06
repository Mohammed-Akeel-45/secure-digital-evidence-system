package models

import (
	"github.com/golang-jwt/jwt/v5"
)

type OraganisationRegistration struct {
	OrganisationName string `json:"org_name" required:"true"`
	AdminEmail       string `json:"admin_email" required:"true"`
	AdminName        string `json:"admin_name" required:"true"`
	AdminPassword    string `json:"admin_password" required:"true"`
}

type AdminLogin struct {
	AdminEmail    string `json:"admin_email" required:"true"`
	AdminPassword string `json:"admin_password" required:"true"`
}

type AdminPublic struct {
	ID      string `db:"user_id"`
	OrgID   string `db:"org_id"`
	OrgName string `db:"org_name"`
	Name    string `db:"user_name"`
	Email   string `db:"user_email"`
}

type Organisation struct {
	ID       int64  `db:"id"`
	PublicID string `db:"public_id"`
	Name     string `db:"name"`
}

type User struct {
	Email          string `json:"email"`
	Name           string `json:"name"`
	OrgID          string `json:"org_id"`
	Password       string `json:"password"`
	OrgRole        string `json:"org_role"`
	DepartmentID   string `json:"department_id"`
	DepartmentRole string `json:"department_role"`
}

type UserDB struct {
	ID         string   `json:"public_id" db:"public_id"`
	OrgID      string   `db:"org_id"`
	Name       string   `json:"name" db:"name"`
	Email      string   `json:"email" db:"email"`
	Roles      []string `json:"roles" db:"roles"`
	Password   string   `db:"password_hash"`
	IsOrgAdmin bool     `db:"is_org_admin"`
	OrgName    string   `db:"org_name"`
}

type Service struct {
	ServiceName string `json:"service_name"`
}

type Claims struct {
	TokenType   string `json:"token_type"`
	OrgID       string `json:"org_id,omitempty"`
	ServiceName string `json:"service_name,omitempty"`
	jwt.RegisteredClaims
}

type DepartmentRegistration struct {
	Name  string `json:"name"`
	OrgID string `json:"org_id,omitempty"`
}

type DepartmentDB struct {
	ID    string `db:"public_id" json:"public_id"`
	Name  string `db:"name" json:"name"`
	OrgID string `db:"org_id" json:"org_id"`
}

type DepartmentResolve struct {
	ID int64 `db:"id"`
}

type UpdateUserDepartment struct {
	UserID string `json:"user_id"`
	ID     string `json:"department_id"`
}

type DeleteDepartment struct {
	ID string `json:"department_id"`
}

type OrganizationUserDTO struct {
	PublicID   string   `db:"public_id" json:"public_id"`
	Name       string   `db:"name" json:"name"`
	Email      string   `db:"email" json:"email"`
	IsOrgAdmin bool     `db:"is_org_admin" json:"is_org_admin"`
	Roles      []string `db:"roles" json:"roles"`
}

type UserDetailsDTO struct {
	PublicID       string `db:"public_id" json:"public_id"`
	Name           string `db:"name" json:"name"`
	Email          string `db:"email" json:"email"`
	IsOrgAdmin     bool   `db:"is_org_admin" json:"is_org_admin"`
	OrgID          string `db:"org_id" json:"org_id"`
	OrgName        string `db:"org_name" json:"org_name"`
	DepartmentID   string `db:"department_id" json:"department_id"`
	DepartmentName string `db:"department_name" json:"department_name"`
}

type PermissionCheckRequest struct {
	UserPublicID string   `json:"user_public_id"`
	Permissions  []string `json:"permissions"`
	Scope        Scope    `json:"scope"`
}

type PermissionCheckResponse struct {
	Allowed            bool     `json:"allowed"`
	MissingPermissions []string `json:"missing_permissions"`
}

type Scope struct {
	Type     string `json:"type"`
	PublicID string `json:"public_id"`
}

type AttachPermissionsToRole struct {
	RoleName    string   `json:"role_name"`
	Scope       Scope    `json:"scope"`
	Permissions []string `json:"permission_names"`
}

type DetachPermissionsFromRole struct {
	RoleName    string   `json:"role_name"`
	Scope       Scope    `json:"scope"`
	Permissions []string `json:"permission_names"`
}

type RoleCreate struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	Scope       Scope    `json:"scope"`
}

type RoleDelete struct {
	Name  string `json:"name"`
	Scope Scope  `json:"scope"`
}

type RoleInternal struct {
	ID int64 `db:"id"`
}

type Role struct {
	PublicID    string `json:"public_id" db:"public_id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	ScopeType   string `json:"scope_type" db:"scope_type"`
	ScopeID     string `json:"scope_id" db:"scope_id"`
	ScopeName   string `json:"scope_name" db:"scope_name"`
}

type RoleAssignment struct {
	Names              []string `json:"role_names"`
	TargetUserPublicID string   `json:"target_user_id"`
	Scope              Scope    `json:"scope"`
}

type RoleRevoke struct {
	Names              []string `json:"role_names"`
	TargetUserPublicID string   `json:"target_user_id"`
	Scope              Scope    `json:"scope"`
}

type Permission struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ResolvedCase struct {
	PublicID string `json:"public_id"`
	Name     string `json:"title"`
	ID       int64  `json:"id"`
}

type CasePublicIDNamePair struct {
	PublicID string
	Name     string
}

type CaseDetails struct {
	ID     int64 `json:"id"`
	OrgID  int64 `json:"org_id"`
	DeptID int64 `json:"dept_id"`
}
