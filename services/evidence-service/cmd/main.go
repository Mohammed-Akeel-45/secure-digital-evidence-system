package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"evidence-service/internal/handler"
	"evidence-service/internal/middleware"
	"evidence-service/internal/services"
	"evidence-service/internal/store"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {

	godotenv.Load()

	connStr := os.Getenv("DB_CONN_STR")

	db, err := store.NewStorage(connStr)
	if err != nil {
		log.Fatal(err)
	}

	dbStrForMigrations := os.Getenv("DB_STR_FOR_MIGRATION")
	if dbStrForMigrations == "" {
		log.Fatal("DB_STR_FOR_MIGRATION not set")
	}
	// Run migrations
	err = runMigrations(dbStrForMigrations)
	if err != nil {
		log.Fatal(err)
	}

	// Initialize S3 Client
	s3Client, err := services.NewS3Client()
	if err != nil {
		log.Printf("Warning: S3 Client initialization failed: %v. Local storage will not work.", err)
		// We don't log.Fatal here to allow the service to start,
		// but requests requiring S3 will fail.
	}

	// Initialize Audit Client
	auditClient := services.NewAuditClient()

	h := &handler.EvidenceHandler{
		Store:       db,
		S3Client:    s3Client,
		AuditClient: auditClient,
	}

	router := mux.NewRouter()

	middleware.InitJWT()

	// Upload evidence (multipart to S3)
	router.Handle("/evidence",
		middleware.JWTMiddleware(http.HandlerFunc(h.CreateEvidence)),
	).Methods("POST")

	// List evidence by case_id query param
	router.Handle("/evidence",
		middleware.JWTMiddleware(http.HandlerFunc(h.ListEvidence)),
	).Methods("GET")

	// Raw binary stream from S3
	router.Handle("/evidence/{id}/file",
		middleware.JWTMiddleware(http.HandlerFunc(h.StreamEvidenceFile)),
	).Methods("GET")

	// Download evidence from S3 by public_id (with metadata)
	router.Handle("/evidence/{id}",
		middleware.JWTMiddleware(http.HandlerFunc(h.GetEvidence)),
	).Methods("GET")

	log.Println("Evidence Service running on :3004 (with S3 Integration)")
	http.ListenAndServe(":3004", router)
}

// Run the latest db migrations.
func runMigrations(db_str string) error {
	m, err := migrate.New(
		"file://./migrations",
		db_str,
	)
	if err != nil {
		return fmt.Errorf("Migration failed to initialize %v", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("Failed to apply migrations: %v", err)
	}

	log.Println("Migrations successfully applied")

	return nil
}
