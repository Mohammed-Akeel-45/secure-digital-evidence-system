package middleware

import (
	"auth-service-go/internal/models"
	"context"
	"crypto/rsa"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

var publicKey *rsa.PublicKey

func SetPublicKey(key *rsa.PublicKey) {
	publicKey = key
}

// JWTMiddleware is a middleware that checks if the request has a valid JWT token.
func JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get the Authorization header.
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
			return
		}

		// Check if the Authorization header is in the correct format.
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		claims := &models.Claims{}

		// Parse and validate the token
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return publicKey, nil
		})
		if err != nil {
			log.Println(err)
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Check if the token has valid claims.
		if claims, ok := token.Claims.(*models.Claims); ok && token.Valid {
			ctx := context.WithValue(r.Context(), "claims", claims)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		log.Println(token.Claims)

		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
	})
}
