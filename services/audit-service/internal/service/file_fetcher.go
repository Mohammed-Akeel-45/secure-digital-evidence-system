package service

import (
	"audit-service/internal/cerrors"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type fileFetcher struct {
	baseURL string
	client  *http.Client
}

func NewFileFetcher(baseURL string, client *http.Client) FileFetcher {
	if baseURL == "" {
		baseURL = os.Getenv("EVIDENCE_SERVICE_URL")
	}
	if baseURL == "" {
		baseURL = "http://sdes_evidence:3004"
	}
	if client == nil {
		client = &http.Client{
			Timeout: 30 * time.Second,
		}
	}
	return &fileFetcher{baseURL: baseURL, client: client}
}

func (f *fileFetcher) GetFile(ctx context.Context, evidenceID string, authToken string) (io.ReadCloser, error) {
	url := fmt.Sprintf("%s/api/v1/evidence/%s/file", strings.TrimSuffix(f.baseURL, "/"), evidenceID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	authHeader := authToken
	if authHeader == "" {
		if token, err := GetDefaultTokenManager().GetToken(ctx); err == nil && token != "" {
			authHeader = "Bearer " + token
		}
	}

	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}

	switch resp.StatusCode {
	case http.StatusOK:
		return resp.Body, nil
	case http.StatusNotFound:
		resp.Body.Close()
		return nil, cerrors.ErrFileNotFound.Error
	default:
		resp.Body.Close()
		return nil, fmt.Errorf("evidence service returned status %d", resp.StatusCode)
	}
}
