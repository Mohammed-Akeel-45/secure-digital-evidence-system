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
	Email    string `json:"email"`
	Name     string `json:"name"`
	OrgID    string `json:"org_id"`
	Role     string `json:"role"`
	Password string `json:"password"`
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
	OrgID string `json:"org_id"`
}

type DepartmentDB struct {
	ID    string `db:"public_id"`
	Name  string `db:"name"`
	OrgID string `db:"org_id"`
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

type PermissionCheckRequest struct {
	UserPublicID string          `json:"user_public_id"`
	Permissions  []string        `json:"permissions"`
	Scope        PermissionScope `json:"scope"`
}

type PermissionCheckResponse struct {
	Allowed bool `json:"allowed"`
}

type PermissionScope struct {
	Type               string `json:"type"`
	OrgPublicID        string `json:"org_public_id,omitempty"`
	DepartmentPublicID string `json:"department_public_id,omitempty"`
	CasePublicID       string `json:"case_public_id,omitempty"`
}

type RoleCreate struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Permissions []string        `json:"permissions"`
	Scope       PermissionScope `json:"scope"`
}

type RoleInternal struct {
	ID int64 `db:"id"`
}
