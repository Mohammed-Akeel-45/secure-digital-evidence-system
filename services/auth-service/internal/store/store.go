package store

import (
	"context"
	"fmt"
	"time"

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
