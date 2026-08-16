package models

type Permission struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Scope struct {
	Type     string `json:"type"`
	PublicID string `json:"public_id"`
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
