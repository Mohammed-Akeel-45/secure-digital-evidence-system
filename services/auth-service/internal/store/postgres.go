package store

import (
	"auth-service-go/internal/models"
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Storage struct {
	DB *pgxpool.Pool
}

// Create new storage handler.
// Takes connection string to the database and service token.
// Returns pointer to the new storage handler created.
func NewStorage(ctx context.Context, connStr string) (*Storage, error) {
	const tries = 5
	const timeout = 2

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	for i := 0; i < tries; i++ {
		err = pool.Ping(ctx)
		if err == nil {
			return &Storage{DB: pool}, nil
		}
		fmt.Printf("Database not ready... retrying in %ds (%d/%d)\n", timeout, i+1, tries)
		time.Sleep(timeout * time.Second)
	}

	pool.Close()
	return nil, fmt.Errorf("could not connect to database after retries: %v", err)
}

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

func (s *Storage) CheckUserIsOrgAdmin(ctx context.Context, userEmail string) bool {
	isAdmin := 0
	query := `
		WITH selected_user AS (
			SELECT id, org_id
			FROM users
			WHERE email = $1
		)
		SELECT 1
		FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		JOIN selected_user u ON u.id = ur.user_id
		WHERE r.org_id = u.org_id
		  AND r.name = 'ORG_ADMIN'
	`

	err := s.DB.QueryRow(ctx, query, userEmail).Scan(&isAdmin)
	if err != nil {
		if err != pgx.ErrNoRows {
			log.Println(err)
		}
		return false
	}

	return isAdmin == 1
}

// Register new organisation and admin user.
// This operation is atomic.
//
// Returns the public ID of the admin user, public ID of the organisation and the name of the admin user.
func (s *Storage) RegisterOrgAndAdmin(ctx context.Context, org *models.OraganisationRegistration) (*models.AdminPublic, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Register the organisation and create the admin user.
	var adminPublic models.AdminPublic
	query := `
		WITH org AS (
		   INSERT INTO organizations(name)
		   VALUES ($1)
		   RETURNING id, public_id, name
		 ),
		inserted_user AS (
		INSERT INTO users (org_id, name, email, password_hash, is_org_admin)
		SELECT id, $2, $3, $4, true
		FROM org
		RETURNING public_id, name, email
		)
		SELECT iu.public_id AS user_id, org.public_id AS org_id, org.name as org_name, iu.name AS user_name, iu.email AS user_email, org.id
		FROM inserted_user iu, org
	`

	var orgID int64
	err = tx.QueryRow(ctx, query, org.OrganisationName, org.AdminName, org.AdminEmail, org.AdminPassword).Scan(
		&adminPublic.ID,
		&adminPublic.OrgID,
		&adminPublic.OrgName,
		&adminPublic.Name,
		&adminPublic.Email,
		&orgID)
	if err != nil {
		return nil, err
	}

	// Create admin role.
	var roleId int64
	err = tx.QueryRow(ctx, `
		INSERT INTO roles (name, description, org_id, scope_type, scope_id) 
		VALUES ('ORG_ADMIN', 'Organisation administrator role', $1, 'ORG', $1)
		RETURNING id
		`, orgID).Scan(&roleId)
	if err != nil {
		return nil, err
	}

	// Attach permissions to the admin role.
	_, err = tx.Exec(
		ctx,
		`
		INSERT INTO role_permissions (role_id, permission_id)
		SELECT $1, p.id
		FROM permissions p
		WHERE p.name LIKE ANY($2::text[])
		`,
		roleId,
		[]string{"%"},
	)
	if err != nil {
		return nil, err
	}

	// Assign the admin role to the admin user.
	_, err = tx.Exec(
		ctx,
		`
		INSERT INTO user_roles (user_id, role_id)
		SELECT u.id, $1
		FROM users u
		WHERE u.public_id = $2
		`,
		roleId,
		adminPublic.ID,
	)
	if err != nil {
		return nil, err
	}

	// Commit the transaction as there are no errors.
	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}
	return &adminPublic, nil
}

func (s *Storage) CheckOrgExists(ctx context.Context, orgName string) bool {
	query := `SELECT id FROM organizations WHERE name = $1`
	// Scan returns an error if no rows are returned.
	err := s.DB.QueryRow(ctx, query, orgName).Scan(&orgName)

	// Err is not nil if the organisation doesn't exist.
	if err != nil {
		return false
	}

	return true
}

func (s *Storage) CreateUser(ctx context.Context, user *models.User) (string, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Resolve org internal ID
	var orgID int64
	err = tx.QueryRow(ctx, "SELECT id FROM organizations WHERE public_id = $1", user.OrgID).Scan(&orgID)
	if err != nil {
		return "", fmt.Errorf("failed to resolve org ID: %w", err)
	}

	// Resolve department internal ID (if provided)
	var deptID *int64
	if user.DepartmentID != "" {
		var id int64
		err = tx.QueryRow(ctx, "SELECT id FROM departments WHERE public_id = $1", user.DepartmentID).Scan(&id)
		if err != nil {
			return "", fmt.Errorf("failed to resolve department ID: %w", err)
		}
		deptID = &id
	}

	// Insert user
	var userInternalID int64
	var userPublicID string
	query := `
		INSERT INTO users (email, name, password_hash, org_id, dept_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, public_id::text
	`
	err = tx.QueryRow(ctx, query, user.Email, user.Name, user.Password, orgID, deptID).Scan(&userInternalID, &userPublicID)
	if err != nil {
		return "", fmt.Errorf("failed to insert user: %w", err)
	}

	// Resolve and assign Org Role
	if user.OrgRole != "" {
		var roleID int64
		err = tx.QueryRow(ctx, `
			SELECT id 
			FROM roles 
			WHERE name = $1 AND scope_type = 'ORG' AND scope_id = $2
		`, user.OrgRole, orgID).Scan(&roleID)
		if err != nil {
			return "", fmt.Errorf("failed to find org role %s: %w", user.OrgRole, err)
		}

		_, err = tx.Exec(ctx, "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)", userInternalID, roleID)
		if err != nil {
			return "", fmt.Errorf("failed to assign org role: %w", err)
		}
	}

	// Resolve and assign Department Role
	if deptID != nil && user.DepartmentRole != "" {
		var roleID int64
		err = tx.QueryRow(ctx, `
			SELECT id 
			FROM roles 
			WHERE name = $1 AND scope_type = 'DEPARTMENT' AND scope_id = $2
		`, user.DepartmentRole, *deptID).Scan(&roleID)
		if err != nil {
			return "", fmt.Errorf("failed to find department role %s: %w", user.DepartmentRole, err)
		}

		_, err = tx.Exec(ctx, "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)", userInternalID, roleID)
		if err != nil {
			return "", fmt.Errorf("failed to assign department role: %w", err)
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to commit user creation: %w", err)
	}

	return userPublicID, nil
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

func (s *Storage) ResolveUserPublicIDToInternalID(ctx context.Context, publicID string) (int64, error) {
	var ID int64
	query := `SELECT id FROM users WHERE public_id = $1`
	err := s.DB.QueryRow(ctx, query, publicID).Scan(&ID)

	if err != nil {
		return 0, err
	}

	return ID, nil
}

func (s *Storage) GetUserByPublicID(ctx context.Context, ID string) (*models.UserDB, error) {
	user := &models.UserDB{}
	query := `
		SELECT u.public_id, u.name, u.email, u.password_hash, o.public_id as org_id, o.name as org_name
		FROM users u, organizations o
		WHERE u.public_id = $1 AND o.id = u.org_id;
	`
	err := s.DB.QueryRow(ctx, query, ID).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.OrgID, &user.OrgName)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Storage) GetUserByEmail(ctx context.Context, email string) (*models.UserDB, error) {
	user := &models.UserDB{}
	query := `
		SELECT u.public_id, u.name, u.email, u.password_hash, u.is_org_admin, o.public_id as org_id, o.name as org_name
		FROM users u, organizations o
		WHERE u.email = $1 AND o.id = u.org_id;
	`
	err := s.DB.QueryRow(ctx, query, email).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.IsOrgAdmin, &user.OrgID, &user.OrgName)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Storage) GetOrgPublicID(ctx context.Context, ID int) (string, error) {
	var orgID string
	query := `
		SELECT public_id as id
		FROM organizations
		WHERE id = $1
	`

	err := s.DB.QueryRow(ctx, query, ID).Scan(&orgID)
	if err != nil {
		return "", err
	}

	return orgID, nil
}

func (s *Storage) GetOrgByPublicID(ctx context.Context, ID string) (*models.Organisation, error) {
	org := &models.Organisation{}
	query := `
		SELECT id, public_id, name
		FROM organizations
		WHERE public_id = $1
	`

	err := s.DB.QueryRow(ctx, query, ID).Scan(&org.ID, &org.PublicID, &org.Name)
	if err != nil {
		return nil, err
	}

	return org, nil
}

func (s *Storage) GetOrgUsers(ctx context.Context, orgID int64) ([]models.OrganizationUserDTO, error) {
	query := `
		SELECT 
			u.public_id,
			u.name,
			u.email,
			u.is_org_admin,
			COALESCE(
				ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL),
				'{}'
			) AS roles
		FROM organizations o
		JOIN users u 
			ON u.org_id = o.id
		LEFT JOIN user_roles ur
			ON ur.user_id = u.id
		LEFT JOIN roles r 
			ON r.id = ur.role_id
		WHERE o.id = $1 
		GROUP BY u.id;
	`
	rows, err := s.DB.Query(ctx, query, orgID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.OrganizationUserDTO])
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (s *Storage) CreateDepartment(ctx context.Context, department *models.DepartmentRegistration) (string, error) {
	var departmentID string
	query := `
		WITH org AS (
		  SELECT id
		  FROM organizations
		  WHERE public_id = $1
		)
		INSERT INTO departments (name, org_id)
		SELECT $2, org.id
		FROM org
		RETURNING public_id
	`

	err := s.DB.QueryRow(ctx, query, department.OrgID, department.Name).Scan(&departmentID)
	if err != nil {
		return "", err
	}

	return departmentID, nil
}

func (s *Storage) ResolveDepartmentByPublicID(ctx context.Context, ID string) (*models.DepartmentResolve, error) {
	department := &models.DepartmentResolve{}
	query := `
		SELECT id
		FROM departments
		WHERE public_id = $1
	`

	err := s.DB.QueryRow(ctx, query, ID).Scan(&department.ID)
	if err != nil {
		return nil, err
	}

	return department, nil
}

func (s *Storage) GetDepartmentByPublicID(ctx context.Context, ID string) (*models.DepartmentDB, error) {
	department := &models.DepartmentDB{}
	query := `
		SELECT public_id, name, org_id
		FROM departments
		WHERE public_id = $1
	`

	err := s.DB.QueryRow(ctx, query, ID).Scan(&department.ID, &department.Name, &department.OrgID)
	if err != nil {
		return nil, err
	}

	return department, nil
}

// GetAllOrgDepartments fetches all departments for a given organization.
func (s *Storage) GetAllOrgDepartments(ctx context.Context, orgID int64) ([]models.DepartmentDB, error) {
	query := `
		SELECT public_id, name, org_id
		FROM departments
		WHERE org_id = $1
	`

	rows, err := s.DB.Query(ctx, query, orgID)
	if err != nil {
		return nil, err
	}

	//  Scan the rows into a slice of structs using pgx.RowToStructByName
	departments, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.DepartmentDB])
	if err != nil {
		return nil, err
	}

	return departments, nil
}

// UpdateUserDepartment updates a user's department to the given department.
func (s *Storage) UpdateUserDepartment(ctx context.Context, userID string, departmentID string) error {
	query := `
		WITH department AS (
			SELECT id
			FROM departments
			WHERE public_id = $1
		)
		UPDATE users
		SET dept_id = department.id
		FROM department
		WHERE public_id = $2
	`

	_, err := s.DB.Exec(ctx, query, departmentID, userID)
	if err != nil {
		return err
	}

	return nil
}

// DeleteDepartmentStart begins a transaction, deletes the department, and returns the tx, deptID and orgID.
func (s *Storage) DeleteDepartmentStart(ctx context.Context, departmentPublicID string) (pgx.Tx, int64, int64, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("failed to start transaction: %w", err)
	}

	query := `
		DELETE FROM departments
		WHERE public_id = $1
		RETURNING id, org_id
	`

	var deptID int64
	var orgID int64
	err = tx.QueryRow(ctx, query, departmentPublicID).Scan(&deptID, &orgID)
	if err != nil {
		tx.Rollback(ctx)
		return nil, 0, 0, fmt.Errorf("error deleting department: %w", err)
	}

	return tx, deptID, orgID, nil
}

// DeleteDepartmentRoles deletes roles associated with the department
func (s *Storage) DeleteDepartmentRoles(ctx context.Context, tx pgx.Tx, deptID int64) error {
	// Delete department roles.
	query := `
		DELETE FROM roles
		WHERE scope_type = 'DEPARTMENT' AND scope_id = $1
	`
	_, err := tx.Exec(ctx, query, deptID)
	if err != nil {
		return fmt.Errorf("error deleting department roles: %w", err)
	}

	return nil
}

func (s *Storage) DeleteCaseRoles(ctx context.Context, tx pgx.Tx, caseIDs []int64) error {
	// Delete case roles.
	query := `
		DELETE FROM roles
		WHERE scope_type = 'CASE' AND scope_id = ANY($1::bigint[])
	`
	result, err := tx.Exec(ctx, query, caseIDs)
	if err != nil {
		return fmt.Errorf("error deleting case roles: %w", err)
	}
	if result.RowsAffected() == 0 && len(caseIDs) > 0 {
		return fmt.Errorf("no rows affected")
	}

	return nil
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

func (s *Storage) ResolveDepartmentInternalIDToPublicID(ctx context.Context, id int64) (string, error) {
	var publicID string
	query := `
		SELECT public_id::text
		FROM departments
		WHERE id = $1
	`
	err := s.DB.QueryRow(ctx, query, id).Scan(&publicID)
	if err != nil {
		return "", fmt.Errorf("error resolving department internal ID: %w", err)
	}
	return publicID, nil
}

func (s *Storage) GetUserDetailsByPublicID(ctx context.Context, publicID string) (*models.UserDetailsDTO, error) {
	user := &models.UserDetailsDTO{}
	query := `
		SELECT 
			u.public_id, 
			u.name, 
			u.email, 
			u.is_org_admin, 
			o.public_id as org_id, 
			o.name as org_name,
			COALESCE(d.public_id::text, '') as department_id,
			COALESCE(d.name, '') as department_name
		FROM users u
		JOIN organizations o ON o.id = u.org_id
		LEFT JOIN departments d ON d.id = u.dept_id
		WHERE u.public_id = $1
	`
	err := s.DB.QueryRow(ctx, query, publicID).Scan(
		&user.PublicID,
		&user.Name,
		&user.Email,
		&user.IsOrgAdmin,
		&user.OrgID,
		&user.OrgName,
		&user.DepartmentID,
		&user.DepartmentName,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting user details: %w", err)
	}
	return user, nil
}

func (s *Storage) DeleteUser(ctx context.Context, publicID string) error {
	query := `
		DELETE FROM users
		WHERE public_id = $1
	`
	_, err := s.DB.Exec(ctx, query, publicID)
	if err != nil {
		return fmt.Errorf("error deleting user: %w", err)
	}
	return nil
}
