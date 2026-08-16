package main

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/handler"
	"auth-service-go/internal/httpcalls"
	"auth-service-go/internal/middleware"
	"auth-service-go/internal/store"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	serviceToken := os.Getenv("SERVICE_TOKEN")

	// Get private key from "private.pem" file.
	privBytes, err := os.ReadFile("private.pem")
	if err != nil {
		log.Fatal(err)
	}
	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(privBytes)
	if err != nil {
		log.Fatal(err)
	}
	auth.SetPrivateKey(privateKey)

	// Get public key from "public.pem" file.
	pubBytes, err := os.ReadFile("public.pem")
	if err != nil {
		log.Fatal(err)
	}
	publicKey, err := jwt.ParseRSAPublicKeyFromPEM(pubBytes)
	if err != nil {
		log.Fatal(err)
	}
	middleware.SetPublicKey(publicKey)

	connStr := os.Getenv("DB_CONN_STR")
	if connStr == "" {
		log.Fatal("No db connStr provided")
	}

	dbStrForMigrations := os.Getenv("DB_STR_FOR_MIGRATION")

	// Run latest migrations.
	err = runMigrations(dbStrForMigrations)
	if err != nil {
		log.Fatal(err)
	}

	// Background context wrapped with a timeout
	startupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db, err := store.NewStorage(startupCtx, connStr)
	if err != nil {
		log.Fatal(err)
	}

	httpCaller := &httpcalls.HTTPCaller{ServiceToken: serviceToken}

	h := &handlerauth.AuthHandler{Store: db, HTTPCaller: httpCaller}
	router := mux.NewRouter()

	// Routes without jwt middleware.
	router.HandleFunc("/api/v1/auth/admin/register", h.AdminRegister).Methods("POST")
	router.HandleFunc("/api/v1/auth/admin/login", h.AdminLogin).Methods("POST")
	router.HandleFunc("/api/v1/auth/login", h.Login).Methods("POST")
	router.HandleFunc("/api/v1/auth/get-service-token", h.GetServiceToken).Methods("POST")

	// Routes with jwt middleware.
	// role routes.
	router.Handle("/api/v1/auth/assign-role", middleware.JWTMiddleware(http.HandlerFunc(h.AssignRole))).Methods("POST")
	router.Handle("/api/v1/auth/revoke-role", middleware.JWTMiddleware(http.HandlerFunc(h.RevokeRole))).Methods("POST")
	router.Handle("/api/v1/auth/detach-permissions-from-role", middleware.JWTMiddleware(http.HandlerFunc(h.DetachPermissionsFromRole))).Methods("POST")
	router.Handle("/api/v1/auth/attach-permissions-to-role", middleware.JWTMiddleware(http.HandlerFunc(h.AttachPermissionsToRole))).Methods("POST")
	router.Handle("/api/v1/auth/create-role", middleware.JWTMiddleware(http.HandlerFunc(h.CreateRole))).Methods("POST")
	router.Handle("/api/v1/auth/delete-role", middleware.JWTMiddleware(http.HandlerFunc(h.DeleteRole))).Methods("POST")
	router.Handle("/api/v1/auth/get-org-roles", middleware.JWTMiddleware(http.HandlerFunc(h.GetOrgRoles))).Methods("GET")
	router.Handle("/api/v1/auth/get-user-roles/{user_id}", middleware.JWTMiddleware(http.HandlerFunc(h.GetUserRoles))).Methods("GET")
	router.Handle("/api/v1/auth/get-all-permissions", middleware.JWTMiddleware(http.HandlerFunc(h.GetAllPermissions))).Methods("GET")
	router.Handle("/api/v1/auth/get-role-permissions/{role_name}", middleware.JWTMiddleware(http.HandlerFunc(h.GetRolePermissions))).Methods("GET")

	// Internal routes.
	router.Handle("/api/v1/auth/internal/org/resolve/{public_id}", middleware.JWTMiddleware(http.HandlerFunc(h.ResolveOrgByPublicID))).Methods("GET")
	router.Handle("/api/v1/auth/internal/org/department/resolve/{public_id}", middleware.JWTMiddleware(http.HandlerFunc(h.ResolveDepartmentByPublicID))).Methods("GET")
	router.Handle("/api/v1/auth/internal/org/department/resolve-internal-id/{internal_id}", middleware.JWTMiddleware(http.HandlerFunc(h.ResolveDepartmentInternalIDToPublicID))).Methods("GET")
	router.Handle("/api/v1/auth/internal/user/resolve/{public_id}", middleware.JWTMiddleware(http.HandlerFunc(h.ResolveUserPublicIDToInternalID))).Methods("GET")
	router.Handle("/api/v1/auth/internal/check-permissions", middleware.JWTMiddleware(http.HandlerFunc(h.CheckPermissions))).Methods("POST")

	// user routes.
	router.Handle("/api/v1/auth/admin/create-user", middleware.JWTMiddleware(http.HandlerFunc(h.CreateUser))).Methods("POST")
	router.Handle("/api/v1/auth/admin/get-org-users", middleware.JWTMiddleware(http.HandlerFunc(h.GetOrgUsers))).Methods("GET")
	router.Handle("/api/v1/auth/admin/get-user/{user_id}", middleware.JWTMiddleware(http.HandlerFunc(h.GetUserDetails))).Methods("GET")
	router.Handle("/api/v1/auth/admin/delete-user/{user_id}", middleware.JWTMiddleware(http.HandlerFunc(h.DeleteUser))).Methods("DELETE")
	router.Handle("/api/v1/auth/admin/update-user-department", middleware.JWTMiddleware(http.HandlerFunc(h.UpdateUserDepartment))).Methods("POST")

	// department routes.
	router.Handle("/api/v1/auth/admin/create-department", middleware.JWTMiddleware(http.HandlerFunc(h.CreateDepartment))).Methods("POST")
	router.Handle("/api/v1/auth/admin/get-org-departments", middleware.JWTMiddleware(http.HandlerFunc(h.GetAllOrgDepartments))).Methods("GET")
	router.Handle("/api/v1/auth/admin/delete-department", middleware.JWTMiddleware(http.HandlerFunc(h.DeleteDepartment))).Methods("DELETE")

	log.Printf("Service running on :%v\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf("0.0.0.0:%s", port), router))
}

// Run the latest db migrations.
func runMigrations(db_str string) error {
	m, err := migrate.New("file://./migrations", db_str)

	if err != nil {
		return fmt.Errorf("Migration failed to initialize %v", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("Failed to apply migrations: %v", err)
	}

	log.Println("Migrations successfully applied")

	return nil
}
