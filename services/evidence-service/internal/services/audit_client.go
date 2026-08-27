package services

import (
	"bytes"
	"context"
	"encoding/json"
	"evidence-service/internal/models"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// AuditRegistrationRequest
type AuditRegistrationRequest struct {
	EvidenceID       int64  `json:"evidence_id"`
	EvidencePublicID string `json:"evidence_public_id"`
	Algorithm        string `json:"algorithm"`
	FileHash         string `json:"file_hash"`
	CaseID           int64  `json:"case_id"`
	UserID           int64  `json:"user_id"`
	Action           string `json:"action"`
	Remarks          string `json:"remarks"`
	ActionMetadata   string `json:"action_metadata"`
	ServiceName      string `json:"service_name"`
	IPAddress        string `json:"ip_address"`
}

type AuditClient struct {
	BaseURL string
	Client  *http.Client
}

func NewAuditClient() *AuditClient {
	url := os.Getenv("AUDIT_SERVICE_URL")
	if url == "" {
		url = "http://sdes_nginx:80"
	}
	return &AuditClient{
		BaseURL: url,
		Client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// RegisterAudit sends metadata to the Audit Service
func (c *AuditClient) RegisterAudit(ctx context.Context, req AuditRegistrationRequest) error {
	if c.BaseURL == "" {
		return fmt.Errorf("AUDIT_SERVICE_URL not configured")
	}

	url := fmt.Sprintf("%s/api/v1/audit/evidence/register", c.BaseURL)
	jsonData, err := json.Marshal(req)
	if err != nil {
		return err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("audit service returned status %d", resp.StatusCode)
	}

	return nil
}

func (c *AuditClient) GetEvidenceStatus(ctx context.Context, evidenceIDs []int64) ([]models.EvidenceStatus, error) {
	if c.BaseURL == "" {
		return nil, fmt.Errorf("AUDIT_SERVICE_URL not configured")
	}

	strEvidenceIDs := make([]string, len(evidenceIDs))
	for i := range len(evidenceIDs) {
		strEvidenceIDs[i] = strconv.Itoa(int(evidenceIDs[i]))
	}

	ids := strings.Join(strEvidenceIDs[:], ",")
	url := fmt.Sprintf("%s/api/v1/audit/evidence/get-status?evidence_ids=%s", c.BaseURL, ids)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("audit service returned status %d", resp.StatusCode)
	}

	var evidenceStatuses []models.EvidenceStatus

	err = json.NewDecoder(resp.Body).Decode(&evidenceStatuses)
	if err != nil {
		return nil, err
	}

	return evidenceStatuses, nil
}
