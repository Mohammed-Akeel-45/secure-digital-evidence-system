package models

import (
	"github.com/golang-jwt/jwt/v5"
)

type OraganisationRegistration struct {
	OrganisationName string `json:"organisation_name"`
	AdminEmail       string `json:"admin_email"`
	AdminName        string `json:"admin_name"`
	AdminPassword    string `json:"admin_password"`
}

type AdminLogin struct {
	OrganisationName string `json:"organisation_name"`
	AdminEmail       string `json:"admin_email"`
	AdminPassword    string `json:"admin_password"`
}

type AdminPublic struct {
	ID      string `db:"user_id"`
	OrgID   string `db:"org_id"`
	OrgName string `db:"org_name"`
	Name    string `db:"user_name"`
	Email   string `db:"user_email"`
}

type Organisation struct {
	ID   string `db:"public_id"`
	Name string `db:"name"`
}

type User struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	OrgID    string `json:"organisation_id"`
	Password string `json:"password"`
}

type UserDB struct {
	ID       string `db:"public_id"`
	OrgID    string `db:"org_id"`
	Name     string `db:"name"`
	Email    string `db:"email"`
	Password string `db:"password_hash"`
	OrgName  string `db:"org_name"`
}

type Service struct {
	ServiceName string `json:"service_name"`
}

type Claims struct {
	UserID   string `json:"id"`
	UserName string `json:"name"`
	Email    string `json:"email"`
	jwt.RegisteredClaims
}

type ServiceClaims struct {
	TokenType   string `json:"token_type"`
	ServiceName string `json:"service_name"`
	jwt.RegisteredClaims
}
