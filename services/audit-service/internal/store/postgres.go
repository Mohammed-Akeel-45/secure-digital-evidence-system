package store

import (
	"audit-service/internal/config"
	"fmt"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
)

type Storage struct {
	DB *sqlx.DB
}

func NewStorage(config *config.EnvDBConfig, setLimits bool) (*Storage, error) {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=false", config.GetHost(), config.GetPort(), config.GetUsername(), config.GetPassword(), config.GetDatabase())
	const tries = 5
	const timeout = 2

	// prepare the driver. Lazy doesn't actually connect.
	db, err := sqlx.Open("pgx", connStr)
	if err != nil {
		return nil, err
	}

	// Start loop to keep try to connect to db with a timeout.
	for i := range tries {
		err := db.Ping()
		// db connection good.
		if err == nil {
			if setLimits {
				log.Println("Setting connection limits, maxOpen: %i, maxIdle: %i", config.GetMaxOpenConns(), config.GetMaxIdleConns())
				db.SetMaxOpenConns(int(config.GetMaxOpenConns()))
				db.SetMaxIdleConns(int(config.GetMaxIdleConns()))
			}
			return &Storage{db}, nil
		}

		fmt.Printf("Database not ready... restarting in %ds (%d/%d)\n", timeout, i+1, tries)
		time.Sleep(timeout * time.Second)
	}

	return nil, fmt.Errorf("could not connect to database after %d retires: %v", tries, err)
}
