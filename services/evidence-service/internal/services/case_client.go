package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

type CaseResponse struct {
	ID       int64  `json:"id"`
	PublicID string `json:"public_id"`
	Title    string `json:"title"`
}

type CaseUserResponse struct {
	PublicID string `json:"public_id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
}

func getCaseServiceURL() string {
	url := os.Getenv("CASE_SERVICE_URL")
	if url == "" {
		url = "http://sdes_case:3003"
	}
	url = strings.TrimSuffix(url, "/")
	if !strings.HasSuffix(url, "/api/v1") {
		url = url + "/api/v1"
	}
	return url
}

// ValidateCase calls the case service to verify the case exists.
// Returns the case response data and error.
func ValidateCase(casePublicID string, token string) (*CaseResponse, error) {

	url := fmt.Sprintf("%s/cases/%s", getCaseServiceURL(), casePublicID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("case not found, status: %d", resp.StatusCode)
	}

	var caseData CaseResponse
	if err := json.NewDecoder(resp.Body).Decode(&caseData); err != nil {
		return nil, fmt.Errorf("failed to decode case response: %w", err)
	}

	return &caseData, nil
}

// CheckUserCaseAccess verifies that a user (by public_id) is assigned to a case.
// It calls the case service's case_users endpoint.
func CheckUserCaseAccess(casePublicID string, userPublicID string, token string) (bool, error) {

	url := fmt.Sprintf("%s/cases/%s/users", getCaseServiceURL(), casePublicID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, err
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return false, fmt.Errorf("failed to fetch case users, status: %d", resp.StatusCode)
	}

	var users []CaseUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return false, fmt.Errorf("failed to decode case users: %w", err)
	}

	for _, u := range users {
		if u.PublicID == userPublicID {
			return true, nil
		}
	}

	return false, nil
}
