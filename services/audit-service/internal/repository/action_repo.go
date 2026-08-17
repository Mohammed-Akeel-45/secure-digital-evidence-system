package repository

import (
	"audit-service/internal/cerrors"
	"audit-service/internal/store"
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type actionRepo struct {
	store *store.Storage
}

func NewActionRepo(store *store.Storage) ActionRepo {
	return &actionRepo{store: store}
}

// Returns a querier for the database.
func (a *actionRepo) q(ctx context.Context) store.PgxQuerier {
	tx := store.ExtractTx(ctx)
	if tx != nil {
		return tx // Use the transaction passed down via the context.
	}
	return a.store.Pool // No transaction passed, use the Pool.
}

func (a *actionRepo) GetActionIDByName(ctx context.Context, name string) (int32, error) {
	var actionID int32
	query := `
		SELECT id 
		FROM integrity_schema.actions 
		WHERE name = $1
	`
	err := a.q(ctx).QueryRow(ctx, query, name).Scan(&actionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, cerrors.ErrActionNotFound.Error
		}
		return 0, fmt.Errorf("failed to get action ID for action '%s': %w", name, err)
	}

	return actionID, nil
}
