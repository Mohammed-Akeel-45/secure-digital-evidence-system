package httpcalls

import (
	"auth-service-go/internal/auth"
	"auth-service-go/internal/models"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type HTTPCaller struct {
	ServiceToken   string
	mu             sync.RWMutex
	cachedToken    string
	tokenExpiresAt time.Time
}

func (h *HTTPCaller) getToken() (string, error) {
	if h.ServiceToken != "" {
		return h.ServiceToken, nil
	}

	h.mu.RLock()
	if h.cachedToken != "" && time.Now().Before(h.tokenExpiresAt.Add(-60*time.Second)) {
		token := h.cachedToken
		h.mu.RUnlock()
		return token, nil
	}
	h.mu.RUnlock()

	h.mu.Lock()
	defer h.mu.Unlock()

	// Double-check after acquiring write lock
	if h.cachedToken != "" && time.Now().Before(h.tokenExpiresAt.Add(-60*time.Second)) {
		return h.cachedToken, nil
	}

	token, err := auth.GenerateServiceToken(models.Service{ServiceName: "auth_service"})
	if err != nil {
		return "", err
	}

	h.cachedToken = token
	h.tokenExpiresAt = time.Now().Add(time.Hour)

	return token, nil
}

func (h *HTTPCaller) ResolveCasePublicIDToInternalID(
	ctx context.Context,
	publicID string,
) (int64, error) {

	url := fmt.Sprintf(
		"http://sdes_nginx:80/api/v1/internal/cases/resolve/%s",
		publicID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		url,
		nil,
	)
	if err != nil {
		return 0, err
	}

	token, err := h.getToken()
	if err != nil {
		return 0, err
	}

	req.Header.Set(
		"Authorization",
		"Bearer "+token,
	)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf(
			"unexpected status code: %d",
			resp.StatusCode,
		)
	}

	var result struct {
		ID int64 `json:"id"`
	}

	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return 0, err
	}

	return result.ID, nil
}

func (h *HTTPCaller) ResolveCaseInternalIDToPublicID(
	ctx context.Context,
	InternalID int64,
) (string, error) {

	url := fmt.Sprintf(
		"http://sdes_nginx:80/api/v1/internal/cases/resolve-internal-id/%d",
		InternalID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		url,
		nil,
	)
	if err != nil {
		return "", err
	}

	token, err := h.getToken()
	if err != nil {
		return "", err
	}

	req.Header.Set(
		"Authorization",
		"Bearer "+token,
	)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf(
			"unexpected status code: %d",
			resp.StatusCode,
		)
	}

	var result struct {
		PublicID string `json:"public_id"`
	}

	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return "", err
	}

	return result.PublicID, nil
}

func (h *HTTPCaller) GetCaseDetails(
	ctx context.Context,
	publicID string,
) (*models.CaseDetails, error) {

	url := fmt.Sprintf(
		"http://sdes_nginx:80/api/v1/cases/%s",
		publicID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		url,
		nil,
	)
	if err != nil {
		return nil, err
	}

	token, err := h.getToken()
	if err != nil {
		return nil, err
	}

	req.Header.Set(
		"Authorization",
		"Bearer "+token,
	)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"unexpected status code: %d",
			resp.StatusCode,
		)
	}

	var result *models.CaseDetails

	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (h *HTTPCaller) DeleteDepartmentCases(
	ctx context.Context,
	orgID int64,
	departmentID int64,
) error {
	url := fmt.Sprintf(
		"http://sdes_nginx:80/api/v1/internal/cases/delete-department-cases?org_id=%d&department_id=%d", orgID, departmentID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodDelete,
		url,
		nil,
	)
	if err != nil {
		return err
	}

	token, err := h.getToken()
	if err != nil {
		return err
	}

	req.Header.Set(
		"Authorization",
		"Bearer "+token,
	)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf(
			"unexpected status code: %d",
			resp.StatusCode,
		)
	}

	return nil
}

func (h *HTTPCaller) GetDepartmentCases(
	ctx context.Context,
	orgID int64,
	departmentID int64,
) ([]int64, error) {
	url := fmt.Sprintf(
		"http://sdes_nginx:80/api/v1/internal/cases/get-department-cases/%d", departmentID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		url,
		nil,
	)
	if err != nil {
		return nil, err
	}

	token, err := h.getToken()
	if err != nil {
		return nil, err
	}

	req.Header.Set(
		"Authorization",
		"Bearer "+token,
	)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"unexpected status code: %d",
			resp.StatusCode,
		)
	}

	var cases struct {
		IDs []int64 `json:"ids"`
	}

	err = json.NewDecoder(resp.Body).Decode(&cases)
	if err != nil {
		return nil, err
	}

	return cases.IDs, nil
}

func (h *HTTPCaller) ResolveCaseInternalIDsToPublicIDs(
	ctx context.Context,
	internalIDs []int64,
) (map[int64]*models.CasePublicIDNamePair, error) {

	if len(internalIDs) == 0 {
		return map[int64]*models.CasePublicIDNamePair{}, nil
	}

	// Format IDs as comma-separated string
	var builder strings.Builder
	for i, id := range internalIDs {
		if i > 0 {
			builder.WriteString(",")
		}
		builder.WriteString(fmt.Sprintf("%d", id))
	}

	url := fmt.Sprintf(
		"http://sdes_nginx:80/api/v1/internal/cases/resolve-multiple-internal-ids?ids=%s",
		builder.String(),
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		url,
		nil,
	)
	if err != nil {
		return nil, err
	}

	token, err := h.getToken()
	if err != nil {
		return nil, err
	}

	req.Header.Set(
		"Authorization",
		"Bearer "+token,
	)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"unexpected status code: %d",
			resp.StatusCode,
		)
	}

	var results []*models.ResolvedCase

	err = json.NewDecoder(resp.Body).Decode(&results)
	if err != nil {
		return nil, err
	}

	// Convert to map for fast lookup
	idMap := make(map[int64]*models.CasePublicIDNamePair)
	for _, res := range results {
		idMap[res.ID] = &models.CasePublicIDNamePair{PublicID: res.PublicID, Name: res.Name}
	}

	return idMap, nil
}

func printPrettyJSON(resp *http.Response) error {
	// Read the body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Initialize a buffer to hold the pretty-printed JSON
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, bodyBytes, "", "  "); err != nil {
		return err
	}

	// Print the result
	fmt.Println(prettyJSON.String())
	return nil
}
