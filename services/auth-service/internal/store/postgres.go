package store

import (
	"auth-service-go/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Storage struct {
	DB *pgxpool.Pool
}

// Create new storage handler.
// Takes connection string to the database.
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

func (s *Storage) ResolveCasePublicIDToInternalID(
	ctx context.Context,
	publicID string,
) (int64, error) {

	url := fmt.Sprintf(
		"http://case_service/api/v1/internal/cases/resolve/%s",
		publicID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		url,
		nil,
	)
	if err != nil {
		return 0, err
	}

	req.Header.Set(
		"Authorization",
		"Bearer "+os.Getenv("SERVICE_TOKEN"),
	)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf(
			"unexpected status code: %d",
			resp.StatusCode,
		)
	}

	var result struct {
		ID int64 `json:"id"`
	}

	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return 0, err
	}

	return result.ID, nil
}

func (s *Storage) AssignRole(ctx context.Context, roleAssignment *models.RoleAssignment) error {
	var query string
	var scopeID int64

	targetUserID, err := s.ResolveUserPublicIDToInternalID(ctx, roleAssignment.TargetUserPublicID)
	if err != nil {
		return err
	}

	switch roleAssignment.Scope.Type {
	case "ORG":
		org, err := s.GetOrgByPublicID(ctx, roleAssignment.Scope.OrgPublicID)
		if err != nil {
			return err
		}
		scopeID = org.ID
		query = `
			INSERT INTO organization_user_roles (user_id, role_id, org_id)
			SELECT $1, r.id, $2
			FROM roles r
			WHERE r.name IN $3::text[]
			ON CONFLICT DO NOTHING
		`
	case "DEPARTMENT":
		department, err := s.ResolveDepartmentByPublicID(ctx, roleAssignment.Scope.DepartmentPublicID)
		if err != nil {
			return err
		}
		scopeID = department.ID
		query = `
			INSERT INTO department_user_roles (user_id, role_id, department_id)
			SELECT $1, r.id, $2
			FROM roles r
			WHERE r.name IN $3::text[]
			ON CONFLICT DO NOTHING
		`
	case "CASE":
		caseID, err := s.ResolveCasePublicIDToInternalID(ctx, roleAssignment.Scope.CasePublicID)
		if err != nil {
			return err
		}
		scopeID = caseID
		query = `
			INSERT INTO case_user_roles (user_id, role_id, case_id)
			SELECT $1, r.id, $2
			FROM roles r
			WHERE r.name IN $3::text[]
			ON CONFLICT DO NOTHING
		`
	default:
		return fmt.Errorf("Invalid scope type")
	}

	_, err = s.DB.Exec(ctx, query, targetUserID, scopeID, roleAssignment.Names)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) RevokeRole(ctx context.Context, roleRevoke *models.RoleRevoke) error {
	var query string
	var scopeID int64

	targetUserID, err := s.ResolveUserPublicIDToInternalID(ctx, roleRevoke.TargetUserPublicID)
	if err != nil {
		return err
	}
	switch roleRevoke.Scope.Type {
	case "ORG":
		org, err := s.GetOrgByPublicID(ctx, roleRevoke.Scope.OrgPublicID)
		if err != nil {
			return err
		}
		scopeID = org.ID
		query = `
			DELETE FROM organization_user_roles
			WHERE user_id = $1
			AND org_id = $2
			AND role_id IN (
				SELECT id
				FROM roles
				WHERE name IN $3::text[]
			)
		`
	case "DEPARTMENT":
		department, err := s.ResolveDepartmentByPublicID(ctx, roleRevoke.Scope.DepartmentPublicID)
		if err != nil {
			return err
		}
		scopeID = department.ID
		query = `
			DELETE FROM department_user_roles
			WHERE user_id = $1
			AND department_id = $2
			AND role_id IN (
				SELECT id
				FROM roles
				WHERE name = $3::text[]
			)
		`
	case "CASE":
		caseID, err := s.ResolveCasePublicIDToInternalID(ctx, roleRevoke.Scope.CasePublicID)
		if err != nil {
			return err
		}
		scopeID = caseID
		query = `
			DELETE FROM case_user_roles
			WHERE user_id = $1
			AND case_id = $2
			AND role_id IN (
				SELECT id
				FROM roles
				WHERE name = $3::text[]
			)
		`
	default:
		return fmt.Errorf("Invalid scope type")
	}

	_, err = s.DB.Exec(ctx, query, targetUserID, scopeID, roleRevoke.Names)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) AttachPermissionsToRole(ctx context.Context, orgPublicID string, attachPermissions *models.AttachPermissionsToRole) error {
	org, err := s.GetOrgByPublicID(ctx, orgPublicID)
	if err != nil {
		return err
	}
	orgID := org.ID

	query := `
		WITH permissions_to_attach AS (
			SELECT id
			FROM permissions
			WHERE name LIKE ANY($1::text[])
		)
		INSERT INTO role_permission (role_id, permission_id)
		SELECT r.id, p.id
		FROM roles r, permissions_to_attach p
		WHERE r.name = $2 AND r.org_id = $3
	`

	_, err = s.DB.Exec(ctx, query, attachPermissions.Permissions, attachPermissions.RoleName, orgID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) DetachPermissionsFromRole(ctx context.Context, orgPublicID string, detachPermissions *models.DetachPermissionsFromRole) error {
	org, err := s.GetOrgByPublicID(ctx, orgPublicID)
	if err != nil {
		return err
	}
	orgID := org.ID

	query := `
		WITH permissions_to_detach AS (
			SELECT id
			FROM permissions
			WHERE name LIKE ANY($1::text[])
		)
		DELETE FROM role_permission
		WHERE role_id IN (
			SELECT r.id
			FROM roles r
			WHERE r.name = $2
			AND r.org_id = $3
		)
		AND permission_id IN (
			SELECT p.id
			FROM permissions_to_detach p
		)
	`

	_, err = s.DB.Exec(ctx, query, detachPermissions.Permissions, detachPermissions.RoleName, orgID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) CheckPermissions(ctx context.Context, permissionCheckRequest *models.PermissionCheckRequest) ([]string, error) {
	var query string
	var scopeID int64
	userID, err := s.ResolveUserPublicIDToInternalID(ctx, permissionCheckRequest.UserPublicID)
	if err != nil {
		return []string{}, err
	}

	switch permissionCheckRequest.Scope.Type {
	case "ORG":
		org, err := s.GetOrgByPublicID(ctx, permissionCheckRequest.Scope.OrgPublicID)
		if err != nil {
			return []string{}, err
		}
		scopeID = org.ID
		query = `
			SELECT p.name
			FROM permissions p
			WHERE p.name LIKE ANY($1::text[])
			EXCEPT
			SELECT DISTINCT p.name
			FROM organization_user_roles our
			JOIN role_permissions rp
				ON rp.role_id = our.role_id
			JOIN permissions p
				ON p.id = rp.permission_id
			WHERE our.user_id = $2
			AND our.org_id = $3;
		`
	case "DEPARTMENT":
		department, err := s.ResolveDepartmentByPublicID(ctx, permissionCheckRequest.Scope.DepartmentPublicID)
		if err != nil {
			return []string{}, err
		}
		scopeID = department.ID
		query = `
			SELECT p.name
			FROM permissions p
			WHERE p.name LIKE ANY($1::text[])
			EXCEPT
			SELECT DISTINCT p.name
			FROM department_user_roles dur
			JOIN role_permissions rp
				ON rp.role_id = dur.role_id
			JOIN permissions p
				ON p.id = rp.permission_id
			WHERE dur.user_id = $2
			AND dur.department_id = $3;
		`
	case "CASE":
		caseID, err := s.ResolveCasePublicIDToInternalID(ctx, permissionCheckRequest.Scope.CasePublicID)
		if err != nil {
			return []string{}, err
		}
		scopeID = caseID
		query = `
			SELECT p.name
			FROM permissions p
			WHERE p.name LIKE ANY($1::text[])
			EXCEPT
			SELECT DISTINCT p.name
			FROM case_user_roles cur
			JOIN role_permissions rp
				ON rp.role_id = cur.role_id
			JOIN permissions p
				ON p.id = rp.permission_id
			WHERE cur.user_id = $2
			AND cur.case_id = $3;
		`
	default:
		return []string{}, fmt.Errorf("Invalid scope type")
	}

	rows, _ := s.DB.Query(ctx, query, permissionCheckRequest.Permissions, userID, scopeID)
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

func (s *Storage) CheckRoleExists(ctx context.Context, roleName string) bool {
	exists := 0
	query := `SELECT 1 FROM roles WHERE name = $1`

	// Scan returns an error if no rows are returned.
	err := s.DB.QueryRow(ctx, query, roleName).Scan(&exists)
	if err != nil {
		return false
	}

	return exists == 1
}

func (s *Storage) CreateRole(ctx context.Context, role *models.RoleCreate) (*models.RoleInternal, error) {
	// Start a transaction.
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	// Ensures the transaction is rolled back if there is an error.
	defer tx.Rollback(ctx)

	// Insert the role into the database.
	var roleId int64
	err = tx.QueryRow(ctx, `INSERT INTO roles (name, description) VALUES ($1, $2)`, role.Name, role.Description).Scan(&roleId)
	if err != nil {
		return nil, err
	}

	// Attach the permissions to the role.
	result, err := tx.Exec(
		ctx,
		`
		INSERT INTO role_permission (role_id, permission_id)
		SELECT $1, p.id
		FROM permissions p
		WHERE p.name LIKE ANY($2::text[])
		`,
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

func (s *Storage) DeleteRole(ctx context.Context, orgPublicID string, roleDelete *models.RoleDelete) error {
	org, err := s.GetOrgByPublicID(ctx, orgPublicID)
	if err != nil {
		return err
	}
	orgID := org.ID

	query := `
		DELETE FROM roles
		WHERE name = $1
		AND org_id = $2
	`

	_, err = s.DB.Exec(ctx, query, roleDelete.Name, orgID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Storage) GetOrgRoles(ctx context.Context, orgPublicID string) ([]models.Role, error) {
	query := `
		SELECT r.name, r.description
		FROM roles r
		JOIN organizations o on o.id = r.org_id
		WHERE o.public_id = $1
	`

	rows, err := s.DB.Query(ctx, query, orgPublicID)
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

func (s *Storage) GetUserRoles(ctx context.Context, userID int64) ([]models.Role, error) {
	query := `
		SELECT r.name, r.description
		FROM roles r
		JOIN organization_user_roles ur
			ON ur.role_id = r.id
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
		FROM organization_user_roles ur
		JOIN selected_user u
		ON u.id = ur.user_id
		WHERE u.org_id = ur.org_id
		AND ur.role_id IN (
			SELECT id
			FROM roles
			WHERE name = 'ORG_ADMIN'
		)
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
		INSERT INTO roles (name, description, org_id) 
		VALUES ('ORG_ADMIN', 'Organisation administrator role', $1)
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
		WITH org AS (
			SELECT id
			FROM organizations
			WHERE public_id = $1
		)
		INSERT INTO organization_user_roles (user_id, role_id, org_id)
		SELECT u.id, $2, o.id
		FROM users u, org o
		WHERE u.public_id = $3
		`,
		adminPublic.OrgID,
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
	var userID string
	query := `
		WITH org AS (
			SELECT id
			FROM organizations
			WHERE public_id = $1
		)
		INSERT INTO users (email, name, password_hash, org_id) 
		SELECT $2, $3, $4, org.id
		FROM org
		RETURNING public_id`

	err := s.DB.QueryRow(ctx, query, user.OrgID, user.Email, user.Name, user.Password).Scan(&userID)
	if err != nil {
		return "", err
	}

	return userID, nil
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

func (s *Storage) GetOrgUsers(ctx context.Context, orgID string) ([]models.OrganizationUserDTO, error) {
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
		LEFT JOIN organization_user_roles ur
			ON ur.user_id = u.id
		LEFT JOIN roles r 
			ON r.id = ur.role_id
		WHERE o.public_id = $1 
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
func (s *Storage) GetAllOrgDepartments(ctx context.Context, orgID string) ([]models.DepartmentDB, error) {
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

// DeleteDepartment deletes a department with the given public id from the organisation.
func (s *Storage) DeleteDepartment(ctx context.Context, departmentID string) error {
	query := `
		DELETE FROM departments
		WHERE public_id = $1
	`

	_, err := s.DB.Exec(ctx, query, departmentID)
	if err != nil {
		return err
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

func (s *Storage) GetRolePermissions(ctx context.Context, roleName string) ([]models.Permission, error) {
	query := `
		SELECT name, description
		FROM permissions
		JOIN role_permissions rp
			ON rp.permission_id = permissions.id
		WHERE rp.role_id = (
			SELECT id
			FROM roles
			WHERE name = $1
		)
	`

	rows, err := s.DB.Query(ctx, query, roleName)
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
