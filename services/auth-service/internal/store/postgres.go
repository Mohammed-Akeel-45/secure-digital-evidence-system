package store

import (
	"auth-service-go/internal/models"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
)

type Storage struct {
	DB *sqlx.DB
}

func (s *Storage) CheckUserIsOrgAdmin(userID string) bool {
	query := `SELECT is_org_admin FROM users WHERE public_id = $1`
	var isOrgAdmin bool
	err := s.DB.QueryRow(query, userID).Scan(&isOrgAdmin)
	if err != nil {
		return false
	}

	return isOrgAdmin
}

// Register new organisation and admin user.
// This operation is atomic.
//
// Returns the public ID of the admin user, public ID of the organisation and the name of the admin user.
func (s *Storage) RegisterOrgAndAdmin(org *models.OraganisationRegistration) (*models.AdminPublic, error) {
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

	err := s.DB.QueryRow(query, org.OrganisationName, org.AdminName, org.AdminEmail, org.AdminPassword).Scan(
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

func (s *Storage) CheckOrgExists(orgName string) bool {
	query := `SELECT id FROM organizations WHERE name = $1`
	// Scan returns an error if no rows are returned.
	err := s.DB.QueryRow(query, orgName).Scan(&orgName)

	// Err is not nil if the organisation doesn't exist.
	if err != nil {
		return false
	}

	return true
}

// Create new storage handler.
// Takes connection string to the database.
// Returns pointer to the new storage handler created.
func NewStorage(connStr string) (*Storage, error) {
	const tries = 5
	const timeout = 2

	// prepare the driver (Lazy, doesn't actaully connect)
	db, err := sqlx.Open("pgx", connStr)
	if err != nil {
		return nil, err
	}

	for i := range tries {
		err = db.Ping()
		if err == nil {
			return &Storage{DB: db}, nil
		}
		fmt.Printf("Database not ready... retrying in %ds (%d/%d)\n", timeout, i+1, tries)
		time.Sleep(timeout * time.Second)
	}

	return nil, fmt.Errorf("could not connect to database after retries: %v", err)
}

func (s *Storage) CreateUser(user *models.User) (string, error) {
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

	err := s.DB.QueryRow(query, user.OrgID, user.Email, user.Name, user.Password).Scan(&userID)
	if err != nil {
		return "", err
	}

	return userID, nil
}

func (s *Storage) GetUserRoleIDByName(roleName string) (int, error) {
	var roleID int
	query := `SELECT id FROM roles WHERE name = $1`
	err := s.DB.QueryRow(query, roleName).Scan(&roleID)

	if err != nil {
		return 0, err
	}

	return roleID, nil
}

func (s *Storage) GetUserRoleByID(roleID int) (string, error) {
	var roleName string
	query := `SELECT name FROM roles WHERE id = $1`
	err := s.DB.QueryRow(query, roleID).Scan(&roleName)

	if err != nil {
		return "", err
	}

	return roleName, nil
}

func (s *Storage) GetUserByPublicID(ID string) (*models.UserDB, error) {
	user := &models.UserDB{}
	query := `
		SELECT u.public_id as id, u.name, u.email, u.password_hash, o.public_id, o.name
		FROM users u, organizations o
		WHERE u.public_id = $1 AND o.id = u.org_id;
	`
	err := s.DB.QueryRow(query, ID).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.OrgID, &user.OrgName)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Storage) GetUserByEmail(email string) (*models.UserDB, error) {
	user := &models.UserDB{}
	query := `
		SELECT u.public_id as id, u.name, u.email, u.password_hash, o.public_id, o.name
		FROM users u, organizations o
		WHERE u.email = $1 AND o.id = u.org_id;
	`
	err := s.DB.QueryRow(query, email).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.OrgID, &user.OrgName)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Storage) GetOrgPublicID(ID int) (string, error) {
	var orgID string
	query := `
		SELECT public_id as id
		FROM organizations
		WHERE id = $1
	`

	err := s.DB.QueryRow(query, ID).Scan(&orgID)
	if err != nil {
		return "", err
	}

	return orgID, nil
}

func (s *Storage) GetOrgByPublicID(ID string) (*models.Organisation, error) {
	org := &models.Organisation{}
	query := `
		SELECT public_id as id, name
		FROM organizations
		WHERE public_id = $1
	`

	err := s.DB.QueryRow(query, ID).Scan(&org.ID, &org.Name)
	if err != nil {
		return nil, err
	}

	return org, nil
}
