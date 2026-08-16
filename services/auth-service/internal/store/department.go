package store

import (
	"auth-service-go/internal/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

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
