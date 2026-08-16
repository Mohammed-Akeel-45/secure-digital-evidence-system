package store

import (
	"auth-service-go/internal/models"
	"context"
)

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
