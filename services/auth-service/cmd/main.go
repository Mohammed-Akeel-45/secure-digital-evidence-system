package main

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/handler"
	"auth-service-go/internal/middleware"
	"auth-service-go/internal/store"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

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

	// Background context wrapped with a timeout
	startupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db, err := store.NewStorage(startupCtx, connStr)
	if err != nil {
		log.Fatal(err)
	}

	h := &handlerauth.AuthHandler{Store: db}
	router := mux.NewRouter()

	// Routes without jwt middleware.
	router.HandleFunc("/api/v1/auth/admin/register", h.AdminRegister).Methods("POST")
	router.HandleFunc("/api/v1/auth/admin/login", h.AdminLogin).Methods("POST")
	router.HandleFunc("/api/v1/auth/login", h.Login).Methods("POST")
	router.HandleFunc("/api/v1/auth/get-service-token", h.GetServiceToken).Methods("POST")

	// Routes with jwt middleware.
	router.Handle("/api/v1/auth/admin/create-user", middleware.JWTMiddleware(http.HandlerFunc(h.CreateUser))).Methods("POST")
	router.Handle("/api/v1/auth/admin/get-org-users", middleware.JWTMiddleware(http.HandlerFunc(h.GetOrgUsers))).Methods("GET")
	router.Handle("/api/v1/auth/admin/create-department", middleware.JWTMiddleware(http.HandlerFunc(h.CreateDepartment))).Methods("POST")
	router.Handle("/api/v1/auth/admin/get-org-departments", middleware.JWTMiddleware(http.HandlerFunc(h.GetAllOrgDepartments))).Methods("GET")
	router.Handle("/api/v1/auth/admin/update-user-department", middleware.JWTMiddleware(http.HandlerFunc(h.UpdateUserDepartment))).Methods("POST")
	router.Handle("/api/v1/auth/admin/delete-department", middleware.JWTMiddleware(http.HandlerFunc(h.DeleteDepartment))).Methods("DELETE")

	log.Printf("Service running on :%v\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf("0.0.0.0:%s", port), router))
}
