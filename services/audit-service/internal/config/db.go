package config

import (
	"os"
)

type EnvDBConfig struct {
	host         string
	port         string
	username     string
	password     string
	database     string
	maxOpenConns int32
	maxIdleConns int32
}

func NewEnvDBConfig(maxOpenConns int32, maxIdleConns int32) *EnvDBConfig {

	return &EnvDBConfig{
		host:         os.Getenv("DB_HOST"),
		port:         os.Getenv("DB_PORT"),
		username:     os.Getenv("DB_USERNAME"),
		password:     os.Getenv("DB_PASSWORD"),
		database:     os.Getenv("DB_DATABASE"),
		maxOpenConns: maxOpenConns,
		maxIdleConns: maxIdleConns,
	}
}

func (c *EnvDBConfig) GetHost() string {
	return c.host
}

func (c *EnvDBConfig) GetPort() string {
	return c.port
}

func (c *EnvDBConfig) GetUsername() string {
	return c.username
}

func (c *EnvDBConfig) GetPassword() string {
	return c.password
}

func (c *EnvDBConfig) GetDatabase() string {
	return c.password
}

func (c *EnvDBConfig) GetMaxOpenConns() int32 {
	return c.maxOpenConns
}

func (c *EnvDBConfig) GetMaxIdleConns() int32 {
	return c.maxIdleConns
}
