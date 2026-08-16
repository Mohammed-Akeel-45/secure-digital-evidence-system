package store

import (
	"auth-service-go/internal/models"
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
)

func (s *Storage) CreateUser(ctx context.Context, user *models.User) (string, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Resolve org internal ID
	var orgID int64
	err = tx.QueryRow(ctx, "SELECT id FROM organizations WHERE public_id = $1", user.OrgID).Scan(&orgID)
	if err != nil {
		return "", fmt.Errorf("failed to resolve org ID: %w", err)
	}

	// 2. Resolve department internal ID (if provided)
	var deptID *int64
	if user.DepartmentID != "" {
		var id int64
		err = tx.QueryRow(ctx, "SELECT id FROM departments WHERE public_id = $1", user.DepartmentID).Scan(&id)
		if err != nil {
			return "", fmt.Errorf("failed to resolve department ID: %w", err)
		}
		deptID = &id
	}

	// 3. Insert user
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

	// 4. Resolve and assign Org Role
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

	// 5. Resolve and assign Department Role
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

	// 6. Commit transaction
	err = tx.Commit(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to commit user creation: %w", err)
	}

	return userPublicID, nil
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
