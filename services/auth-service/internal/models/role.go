package models

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
