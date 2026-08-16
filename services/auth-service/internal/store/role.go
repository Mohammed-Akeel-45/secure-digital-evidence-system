package store

import (
	"auth-service-go/internal/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func (s *Storage) CheckRoleExists(ctx context.Context, roleName string, scopeType string, scopeIDInternal int64) (bool, error) {
	exists := 0
	query := `SELECT 1 FROM roles WHERE name = $1 AND scope_type = $2 AND scope_id = $3`

	// Scan returns an error if no rows are returned.
	err := s.DB.QueryRow(ctx, query, roleName, scopeType, scopeIDInternal).Scan(&exists)
	if err != nil {
		// No rows match the given role details, meaning role doesn't already exist.
		if err == pgx.ErrNoRows {
			return false, nil
		}
		// Some other error
		return false, fmt.Errorf("Error querying db")
	}

	// A row was returned by db that matchs the given row details.
	return true, nil
}

func (s *Storage) CreateRole(ctx context.Context, orgPublicID string, role *models.RoleCreate, scopeID int64) (*models.RoleInternal, error) {
	org, err := s.GetOrgByPublicID(ctx, orgPublicID)
	if err != nil {
		return nil, err
	}
	orgID := org.ID

	// Start a transaction.
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	query := `INSERT INTO roles (name, description, org_id, scope_type, scope_id) 
			  VALUES ($1, $2, $3, $4, $5) 
			  RETURNING id`

	// Insert the role into the database.
	var roleId int64
	err = tx.QueryRow(ctx, query, role.Name, role.Description, orgID, role.Scope.Type, scopeID).Scan(&roleId)
	if err != nil {
		return nil, err
	}

	query = `
		INSERT INTO role_permissions (role_id, permission_id)
		SELECT $1, p.id
		FROM permissions p
		WHERE p.name LIKE ANY($2::text[])
	`

	// Attach the permissions to the role.
	result, err := tx.Exec(
		ctx,
		query,
		roleId,
		role.Permissions,
	)
	if err != nil {
		return nil, err
	}

	rowsAffected := result.RowsAffected()

	// Check if the number of rows affected is equal to the number of permissions.
	if rowsAffected != int64(len(role.Permissions)) {
		return nil, fmt.Errorf("Invalid permissions provided")
	}

	createdRole := &models.RoleInternal{ID: roleId}

	// Commit the transaction as there are no errors.
	tx.Commit(ctx)
	return createdRole, nil
}

func (s *Storage) DeleteRole(ctx context.Context, roleDelete *models.RoleDelete, scopeID int64) error {
	query := `
		DELETE FROM roles 
		WHERE name = $1 AND scope_type = $2 AND scope_id = $3 
	`

	_, err := s.DB.Exec(ctx, query, roleDelete.Name, roleDelete.Scope.Type, scopeID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) GetOrgRoles(ctx context.Context, orgPublicID string, scopeType string) ([]models.Role, error) {
	org, err := s.GetOrgByPublicID(ctx, orgPublicID)
	if err != nil {
		return nil, err
	}
	orgID := org.ID

	var query string
	var rows pgx.Rows
	switch scopeType {
	case "ORG":
		query = ` 
			SELECT r.public_id, r.name, r.description, r.scope_type, o.public_id::text as scope_id, o.name as scope_name
			FROM roles r
			JOIN organizations o ON r.scope_id = o.id
			WHERE r.org_id = $1 AND r.scope_type = 'ORG' 
		`
		rows, err = s.DB.Query(ctx, query, orgID)
	case "DEPARTMENT":
		query = `
			SELECT r.public_id, r.name, r.description, r.scope_type, d.public_id as scope_id, d.name as scope_name
			FROM roles r
			JOIN departments d ON r.scope_id = d.id
			WHERE r.org_id = $1 AND r.scope_type = 'DEPARTMENT' 
		`
		rows, err = s.DB.Query(ctx, query, orgID)
	case "CASE":
		query = `
			SELECT r.public_id, r.name, r.description, r.scope_type, r.scope_id::text as scope_id
			FROM roles r
			WHERE r.org_id = $1 AND r.scope_type = 'CASE' 
		`
		rows, err = s.DB.Query(ctx, query, orgID)
	default:
		query = `
			SELECT 
				r.public_id, 
				r.name, 
				r.description, 
				r.scope_type, 
				(
					CASE 
					  WHEN r.scope_type = 'ORG' THEN o.public_id::text
					  WHEN r.scope_type = 'DEPARTMENT' THEN d.public_id::text
					  ELSE r.scope_id::text
					END
				) as scope_id,
				(
					CASE 
					  WHEN r.scope_type = 'ORG' THEN o.name 
					  WHEN r.scope_type = 'DEPARTMENT' THEN d.name 
					  ELSE ''
					END
				) as scope_name
			FROM auth_schema.roles r 
			LEFT JOIN auth_schema.organizations o ON r.scope_id = o.id
			LEFT JOIN auth_schema.departments d ON r.scope_id = d.id
			WHERE r.org_id = $1;
		`
		rows, err = s.DB.Query(ctx, query, orgID)
	}
	if err != nil {
		return nil, err
	}

	roles, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[models.Role])
	if err != nil {
		return nil, err
	}

	return roles, nil
}

func (s *Storage) GetUserRoles(ctx context.Context, userID int64) ([]models.Role, error) {
	query := `
		SELECT 
			r.public_id,
			r.name, 
			r.description, 
			r.scope_type, 
			CASE 
				WHEN r.scope_type = 'ORG' THEN o.public_id::text
				WHEN r.scope_type = 'DEPARTMENT' THEN d.public_id::text
				ELSE r.scope_id::text
			END AS scope_id,
			CASE 
				WHEN r.scope_type = 'ORG' THEN o.name
				WHEN r.scope_type = 'DEPARTMENT' THEN d.name
				ELSE ''
			END AS scope_name
		FROM roles r
		JOIN user_roles ur
			ON ur.role_id = r.id
		LEFT JOIN organizations o ON r.scope_type = 'ORG' AND r.scope_id = o.id
		LEFT JOIN departments d ON r.scope_type = 'DEPARTMENT' AND r.scope_id = d.id
		WHERE ur.user_id = $1
	`

	rows, err := s.DB.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roles, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Role])
	if err != nil {
		return nil, err
	}

	return roles, nil
}

func (s *Storage) GetUserRoleIDByName(ctx context.Context, roleName string) (int, error) {
	var roleID int
	query := `SELECT id FROM roles WHERE name = $1`
	err := s.DB.QueryRow(ctx, query, roleName).Scan(&roleID)

	if err != nil {
		return 0, err
	}

	return roleID, nil
}

func (s *Storage) GetUserRoleByID(ctx context.Context, roleID int) (string, error) {
	var roleName string
	query := `SELECT name FROM roles WHERE id = $1`
	err := s.DB.QueryRow(ctx, query, roleID).Scan(&roleName)

	if err != nil {
		return "", err
	}

	return roleName, nil
}

func (s *Storage) AssignRole(ctx context.Context, roleAssignment *models.RoleAssignment, scopeID int64) error {
	targetUserID, err := s.ResolveUserPublicIDToInternalID(ctx, roleAssignment.TargetUserPublicID)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO user_roles (user_id, role_id)
		SELECT $1, r.id
		FROM roles r
		WHERE r.name = ANY($2::text[])
		  AND r.scope_type = $3
		  AND r.scope_id = $4
		ON CONFLICT DO NOTHING
	`
	_, err = s.DB.Exec(ctx, query, targetUserID, roleAssignment.Names, roleAssignment.Scope.Type, scopeID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) RevokeRole(ctx context.Context, roleRevoke *models.RoleRevoke, scopeID int64) error {
	targetUserID, err := s.ResolveUserPublicIDToInternalID(ctx, roleRevoke.TargetUserPublicID)
	if err != nil {
		return err
	}

	query := `
		DELETE FROM user_roles
		WHERE user_id = $1
		  AND role_id IN (
			SELECT id
			FROM roles
			WHERE name = ANY($2::text[])
			  AND scope_type = $3
			  AND scope_id = $4
		  )
	`
	_, err = s.DB.Exec(ctx, query, targetUserID, roleRevoke.Names, roleRevoke.Scope.Type, scopeID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) AttachPermissionsToRole(ctx context.Context, orgPublicID string, attachPermissions *models.AttachPermissionsToRole, scopeID int64) error {
	query := `
		WITH permissions_to_attach AS (
			SELECT id
			FROM permissions
			WHERE name LIKE ANY($1::text[])
		)
		INSERT INTO role_permissions (role_id, permission_id)
		SELECT r.id, p.id
		FROM roles r, permissions_to_attach p
		WHERE r.name = $2 AND r.scope_type = $3 AND r.scope_id = $4
	`

	_, err := s.DB.Exec(
		ctx,
		query,
		attachPermissions.Permissions,
		attachPermissions.RoleName,
		attachPermissions.Scope.Type,
		scopeID,
	)

	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) DetachPermissionsFromRole(ctx context.Context, detachPermissions *models.DetachPermissionsFromRole, scopeID int64) error {
	query := `
		WITH permissions_to_detach AS (
			SELECT id
			FROM permissions
			WHERE name LIKE ANY($1::text[])
		)
		DELETE FROM role_permissions
		WHERE role_id IN (
			SELECT r.id
			FROM roles r
			WHERE r.name = $2
			AND r.scope_type = $3
			AND r.scope_id = $4
		)
		AND permission_id IN (
			SELECT p.id
			FROM permissions_to_detach p
		)
	`

	_, err := s.DB.Exec(
		ctx,
		query,
		detachPermissions.Permissions,
		detachPermissions.RoleName,
		detachPermissions.Scope.Type,
		scopeID,
	)

	if err != nil {
		return err
	}

	return nil
}
