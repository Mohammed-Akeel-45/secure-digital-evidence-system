package models

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

type UpdateUserDepartment struct {
	UserID string `json:"user_id"`
	ID     string `json:"department_id"`
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
