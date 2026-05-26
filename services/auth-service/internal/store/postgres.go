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

func (s *Storage) CheckUserIsOrgAdmin(ctx context.Context, userID string) bool {
	query := `SELECT is_org_admin FROM users WHERE public_id = $1`
	var isOrgAdmin bool
	err := s.DB.QueryRow(ctx, query, userID).Scan(&isOrgAdmin)
	if err != nil {
		if err != pgx.ErrNoRows {
			log.Println(err)
		}
		return false
	}

	return isOrgAdmin
}

// Register new organisation and admin user.
// This operation is atomic.
//
// Returns the public ID of the admin user, public ID of the organisation and the name of the admin user.
func (s *Storage) RegisterOrgAndAdmin(ctx context.Context, org *models.OraganisationRegistration) (*models.AdminPublic, error) {
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
		SELECT iu.public_id AS user_id, org.public_id AS org_id, org.name as org_name, iu.name AS user_name, iu.email AS user_email
		FROM inserted_user iu, org
	`

	err := s.DB.QueryRow(ctx, query, org.OrganisationName, org.AdminName, org.AdminEmail, org.AdminPassword).Scan(
		&adminPublic.ID,
		&adminPublic.OrgID,
		&adminPublic.OrgName,
		&adminPublic.Name,
		&adminPublic.Email)
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
		SELECT public_id, name
		FROM organizations
		WHERE public_id = $1
	`

	err := s.DB.QueryRow(ctx, query, ID).Scan(&org.ID, &org.Name)
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
		LEFT JOIN user_roles ur 
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
