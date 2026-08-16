package store

import (
	"auth-service-go/internal/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func (s *Storage) ScopePublicIDToInternalID(ctx context.Context, scope models.Scope) (int64, error) {
	switch scope.Type {
	case "ORG":
		org, err := s.GetOrgByPublicID(ctx, scope.PublicID)
		if err != nil {
			return 0, err
		}
		return org.ID, nil
	case "DEPARTMENT":
		department, err := s.ResolveDepartmentByPublicID(ctx, scope.PublicID)
		if err != nil {
			return 0, err
		}
		return department.ID, nil
	default:
		return 0, fmt.Errorf("Invalid scope type or scope resolved by handler")
	}
}

func (s *Storage) GetAllPermissions(ctx context.Context) ([]models.Permission, error) {
	query := `
		SELECT name, description
		FROM permissions
	`

	rows, err := s.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	//  Scan the rows into a slice of structs using pgx.RowToStructByName
	permissions, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Permission])
	if err != nil {
		return nil, err
	}

	return permissions, nil
}

func (s *Storage) GetRolePermissions(ctx context.Context, roleName string, scopeType string, scopeID int64) ([]models.Permission, error) {
	var query string
	var args []any

	if scopeType != "" && scopeID != 0 {
		query = `
			SELECT name, description
			FROM permissions
			JOIN role_permissions rp
				ON rp.permission_id = permissions.id
			WHERE rp.role_id = (
				SELECT id
				FROM roles
				WHERE name = $1 AND scope_type = $2 AND scope_id = $3
			)
		`
		args = []any{roleName, scopeType, scopeID}
	} else {
		query = `
			SELECT name, description
			FROM permissions
			JOIN role_permissions rp
				ON rp.permission_id = permissions.id
			WHERE rp.role_id IN (
				SELECT id
				FROM roles
				WHERE name = $1
			)
		`
		args = []any{roleName}
	}

	rows, err := s.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	//  Scan the rows into a slice of structs using pgx.RowToStructByName
	permissions, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Permission])
	if err != nil {
		return nil, err
	}

	return permissions, nil
}

func (s *Storage) CheckPermissions(ctx context.Context, permissionCheckRequest *models.PermissionCheckRequest, caseDetails *models.CaseDetails) ([]string, error) {
	var rows pgx.Rows
	var query string
	userID, err := s.ResolveUserPublicIDToInternalID(ctx, permissionCheckRequest.UserPublicID)
	if err != nil {
		return []string{}, err
	}

	switch permissionCheckRequest.Scope.Type {
	case "ORG":
		org, err := s.GetOrgByPublicID(ctx, permissionCheckRequest.Scope.PublicID)
		if err != nil {
			return []string{}, err
		}
		query = `
			SELECT p.name
			FROM permissions p
			WHERE p.name LIKE ANY($1::text[])
			EXCEPT
			SELECT DISTINCT p.name
			FROM user_roles ur
			JOIN roles r ON r.id = ur.role_id
			JOIN role_permissions rp ON rp.role_id = r.id
			JOIN permissions p ON p.id = rp.permission_id
			WHERE ur.user_id = $2
			  AND r.scope_type = 'ORG' AND r.scope_id = $3;
		`
		rows, _ = s.DB.Query(ctx, query, permissionCheckRequest.Permissions, userID, org.ID)
	case "DEPARTMENT":
		department, err := s.ResolveDepartmentByPublicID(ctx, permissionCheckRequest.Scope.PublicID)
		if err != nil {
			return []string{}, err
		}
		query = `
			SELECT p.name
			FROM permissions p
			WHERE p.name LIKE ANY($1::text[])
			EXCEPT
			SELECT DISTINCT p.name
			FROM user_roles ur
			JOIN roles r ON r.id = ur.role_id
			JOIN role_permissions rp ON rp.role_id = r.id
			JOIN permissions p ON p.id = rp.permission_id
			WHERE ur.user_id = $2
			  AND (
				(r.scope_type = 'DEPARTMENT' AND r.scope_id = $3)
				OR
				(r.scope_type = 'ORG' AND r.scope_id = (
					SELECT org_id FROM auth_schema.departments WHERE id = $3
				))
			  );
		`
		rows, _ = s.DB.Query(ctx, query, permissionCheckRequest.Permissions, userID, department.ID)
	case "CASE":
		if caseDetails == nil {
			return []string{}, fmt.Errorf("Case details must be provided by the handler layer for CASE scope check")
		}
		query = `
			SELECT p.name
			FROM permissions p
			WHERE p.name LIKE ANY($1::text[])
			EXCEPT
			SELECT DISTINCT p.name
			FROM user_roles ur
			JOIN roles r ON r.id = ur.role_id
			JOIN role_permissions rp ON rp.role_id = r.id
			JOIN permissions p ON p.id = rp.permission_id
			WHERE ur.user_id = $2
			  AND (
				(r.scope_type = 'CASE' AND r.scope_id = $3)
				OR
				(r.scope_type = 'DEPARTMENT' AND r.scope_id = $4)
				OR
				(r.scope_type = 'ORG' AND r.scope_id = $5)
			  );
		`
		rows, _ = s.DB.Query(ctx, query, permissionCheckRequest.Permissions, userID, caseDetails.ID, caseDetails.DeptID, caseDetails.OrgID)
	default:
		return []string{}, fmt.Errorf("Invalid scope type")
	}

	defer rows.Close()

	// Scan the rows into a slice of strings.
	var missingPermissions []string
	for rows.Next() {
		var permission string
		err := rows.Scan(&permission)
		if err != nil {
			return []string{}, err
		}
		missingPermissions = append(missingPermissions, permission)
	}

	return missingPermissions, nil
}
