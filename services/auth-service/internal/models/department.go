package models

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

type DeleteDepartment struct {
	ID string `json:"department_id"`
}
