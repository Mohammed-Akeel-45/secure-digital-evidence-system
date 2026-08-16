package models

import (
	"github.com/golang-jwt/jwt/v5"
)

type OraganisationRegistration struct {
	OrganisationName string `json:"org_name" required:"true"`
	AdminEmail       string `json:"admin_email" required:"true"`
	AdminName        string `json:"admin_name" required:"true"`
	AdminPassword    string `json:"admin_password" required:"true"`
}

type AdminLogin struct {
	AdminEmail    string `json:"admin_email" required:"true"`
	AdminPassword string `json:"admin_password" required:"true"`
}

type AdminPublic struct {
	ID      string `db:"user_id"`
	OrgID   string `db:"org_id"`
	OrgName string `db:"org_name"`
	Name    string `db:"user_name"`
	Email   string `db:"user_email"`
}

type Service struct {
	ServiceName   string `json:"service_name"`
	ServiceSecret string `json:"service_secret"`
}

type Claims struct {
	TokenType   string `json:"token_type"`
	OrgID       string `json:"org_id,omitempty"`
	ServiceName string `json:"service_name,omitempty"`
	jwt.RegisteredClaims
}
