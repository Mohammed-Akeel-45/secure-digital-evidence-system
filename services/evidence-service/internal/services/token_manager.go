package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

type TokenManager struct {
	authServiceURL string
	serviceName    string
	serviceSecret  string
	client         *http.Client

	mu        sync.RWMutex
	token     string
	expiresAt time.Time
}

var defaultTokenManager *TokenManager
var once sync.Once

// GetDefaultTokenManager returns a singleton instance of TokenManager configured from environment variables.
func GetDefaultTokenManager() *TokenManager {
	once.Do(func() {
		authURL := os.Getenv("AUTH_SERVICE_URL")
		if authURL == "" {
			authURL = "http://sdes_auth:3001"
		}

		serviceName := os.Getenv("SERVICE_NAME")
		if serviceName == "" {
			serviceName = "evidence_service"
		}

		serviceSecret := os.Getenv("SERVICE_SECRET")
		if serviceSecret == "" {
			serviceSecret = os.Getenv("SERVICE_SECRET_EVIDENCE_SERVICE")
		}

		defaultTokenManager = &TokenManager{
			authServiceURL: authURL,
			serviceName:    serviceName,
			serviceSecret:  serviceSecret,
			client: &http.Client{
				Timeout: 10 * time.Second,
			},
		}
	})
	return defaultTokenManager
}

// GetToken returns a valid service JWT token, auto-fetching and refreshing before expiration.
func (tm *TokenManager) GetToken(ctx context.Context) (string, error) {
	// Fallback to static token if no secret is configured
	if tm.serviceSecret == "" {
		if staticToken := os.Getenv("SERVICE_TOKEN"); staticToken != "" {
			return staticToken, nil
		}
	}

	// Read lock for cached token check
	tm.mu.RLock()
	if tm.token != "" && time.Now().Before(tm.expiresAt.Add(-60*time.Second)) {
		token := tm.token
		tm.mu.RUnlock()
		return token, nil
	}
	tm.mu.RUnlock()

	// Write lock to refresh token
	tm.mu.Lock()
	defer tm.mu.Unlock()

	// Double-check after acquiring write lock
	if tm.token != "" && time.Now().Before(tm.expiresAt.Add(-60*time.Second)) {
		return tm.token, nil
	}

	url := fmt.Sprintf("%s/api/v1/auth/get-service-token", tm.authServiceURL)
	payload, err := json.Marshal(map[string]string{
		"service_name":   tm.serviceName,
		"service_secret": tm.serviceSecret,
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal token request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := tm.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to contact auth-service for token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("auth-service returned HTTP %d when requesting service token", resp.StatusCode)
	}

	var res struct {
		ServiceName  string `json:"service_name"`
		ServiceToken string `json:"service_token"`
		ExpiresIn    int64  `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", fmt.Errorf("failed to decode service token response: %w", err)
	}

	if res.ServiceToken == "" {
		return "", fmt.Errorf("auth-service returned empty service token")
	}

	expiresIn := res.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600
	}

	tm.token = res.ServiceToken
	tm.expiresAt = time.Now().Add(time.Duration(expiresIn) * time.Second)

	return tm.token, nil
}
