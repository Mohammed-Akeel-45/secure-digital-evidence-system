package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"

	"evidence-service/internal/models"
	"evidence-service/internal/services"
	"evidence-service/internal/store"

	"github.com/gorilla/mux"
)

type EvidenceHandler struct {
	Store       *store.Storage
	S3Client    *services.S3Client
	AuditClient *services.AuditClient
}

// CreateEvidence handles multipart file uploads to S3
func (h *EvidenceHandler) CreateEvidence(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userPublicID := claims.Subject

	// Parse multipart form (10MB max)
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, `{"error":"file too large"}`, http.StatusBadRequest)
		return
	}

	casePublicID := r.FormValue("case_id")
	if casePublicID == "" {
		http.Error(w, `{"error":"case_id is required"}`, http.StatusBadRequest)
		return
	}

	// Get file from multipart
	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"file is required"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Extract token for inter-service calls
	token := r.Header.Get("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")

	// Validate case exists via case service
	caseResp, err := services.ValidateCase(casePublicID, token)
	if err != nil {
		log.Printf("Case validation failed: %v", err)
		http.Error(w, `{"error":"case not found or invalid"}`, http.StatusNotFound)
		return
	}

	// Check user has access to this case
	hasAccess, err := services.CheckUserCaseAccess(casePublicID, userPublicID, token)
	if err != nil || !hasAccess {
		http.Error(w, `{"error":"access denied: user not assigned to this case"}`, http.StatusForbidden)
		return
	}

	// Generate SHA256 hash of file content
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		http.Error(w, `{"error":"error hashing file"}`, http.StatusInternalServerError)
		return
	}
	hash := hex.EncodeToString(hasher.Sum(nil))

	// Reset file pointer after hashing
	if _, err := file.Seek(0, 0); err != nil {
		http.Error(w, `{"error":"failed to seek file"}`, http.StatusInternalServerError)
		return
	}

	// Upload to S3
	s3Key := fmt.Sprintf("%s_%s", hash, fileHeader.Filename)
	err = h.S3Client.UploadFile(context.TODO(), s3Key, file)
	if err != nil {
		log.Printf("S3 upload error: %v", err)
		http.Error(w, `{"error":"failed to upload file to S3"}`, http.StatusInternalServerError)
		return
	}

	// Resolve user public_id (UUID) to internal bigint ID
	var userInternalID int64
	err = h.Store.DB.Get(&userInternalID,
		`SELECT id FROM auth_schema.users WHERE public_id = $1`, userPublicID)
	if err != nil {
		log.Printf("Failed to resolve user internal ID: %v", err)
		http.Error(w, `{"error":"user not found"}`, http.StatusBadRequest)
		return
	}

	// Detect MIME type from file header
	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// Insert into DB — capture the internal BIGINT ID for the audit service
	var insertedID int64
	var insertedPublicID string
	err = h.Store.DB.QueryRow(
		`INSERT INTO evidence
		(case_id, file_name, mime_type, file_size, storage_path, current_hash, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, public_id`,
		caseResp.ID,
		fileHeader.Filename,
		mimeType,
		fileHeader.Size,
		s3Key,
		hash,
		userInternalID,
	).Scan(&insertedID, &insertedPublicID)

	if err != nil {
		log.Printf("DB insert error: %v", err)
		http.Error(w, `{"error":"failed to store evidence metadata"}`, http.StatusInternalServerError)
		return
	}

	// 5. Register with Audit Service (Audit flow)
	var userName string
	_ = h.Store.DB.Get(&userName, `SELECT name FROM auth_schema.users WHERE id = $1`, userInternalID)
	if userName == "" {
		userName = "User"
	}

	metadata := map[string]any{
		"file_name":      fileHeader.Filename,
		"file_size":      fileHeader.Size,
		"case_title":     caseResp.Title,
		"case_public_id": caseResp.PublicID,
		"user_name":      userName,
		"user_public_id": userPublicID,
	}
	metadataJSON, _ := json.Marshal(metadata)
	metadataStr := string(metadataJSON)
	clientIP := r.Header.Get("X-Forwarded-For")
	if clientIP == "" {
		clientIP = r.Header.Get("X-Real-IP")
	}
	if clientIP == "" {
		clientIP = r.RemoteAddr
	}
	if host, _, err := net.SplitHostPort(clientIP); err == nil {
		clientIP = host
	}
	if clientIP == "" {
		clientIP = "127.0.0.1"
	}

	go func() {
		auditReq := services.AuditRegistrationRequest{
			EvidenceID:       insertedID,
			EvidencePublicID: insertedPublicID,
			Algorithm:        "SHA256",
			FileHash:         hash,
			CaseID:           caseResp.ID,
			UserID:           userInternalID,
			Action:           "UPLOAD",
			ActionMetadata:   metadataStr,
			Remarks:          fmt.Sprintf("Uploaded '%s' to case '%s' by %s", fileHeader.Filename, caseResp.Title, userName),
			ServiceName:      "evidence-service",
			IPAddress:        clientIP,
		}

		h.Store.DB.Get(&auditReq.EvidencePublicID, "SELECT public_id FROM evidence WHERE id = $1", insertedID)

		err := h.AuditClient.RegisterAudit(context.Background(), auditReq)
		if err != nil {
			log.Printf("CRITICAL: Failed to register evidence with Audit Service: %v", err)
		} else {
			log.Printf("Successfully registered audit for evidence ID %d", insertedID)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "uploaded",
		"hash":   hash,
		"file":   fileHeader.Filename,
		"size":   fileHeader.Size,
		"s3_key": s3Key,
	})
}

// GetEvidence handles downloading evidence from S3 with metadata headers
func (h *EvidenceHandler) GetEvidence(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userPublicID := claims.Subject

	vars := mux.Vars(r)
	evidencePublicID := vars["id"]

	// Look up evidence record
	var evidence models.Evidence
	err := h.Store.DB.Get(&evidence,
		`SELECT e.id, e.public_id, c.public_id AS case_id, e.file_name, e.file_size, e.storage_path,
		        e.current_hash, e.uploaded_by, e.uploaded_at
		 FROM evidence e
		 JOIN case_schema.cases c ON c.id = e.case_id
		 WHERE e.public_id = $1`,
		evidencePublicID,
	)
	if err != nil {
		http.Error(w, `{"error":"evidence not found"}`, http.StatusNotFound)
		return
	}

	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	// Check access
	hasAccess, err := services.CheckUserCaseAccess(evidence.CaseID, userPublicID, token)
	if err != nil || !hasAccess {
		http.Error(w, `{"error":"access denied"}`, http.StatusForbidden)
		return
	}

	// Download from S3
	body, err := h.S3Client.DownloadFile(context.TODO(), evidence.StoragePath)
	if err != nil {
		log.Printf("S3 download error: %v", err)
		http.Error(w, `{"error":"failed to fetch from S3"}`, http.StatusInternalServerError)
		return
	}
	defer body.Close()

	// Serve with metadata headers
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, evidence.FileName))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", evidence.FileSize))
	io.Copy(w, body)
}

// StreamEvidenceFile implements GET /evidence/{id}/file
// Returns raw binary stream with no additional headers or buffering
func (h *EvidenceHandler) StreamEvidenceFile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}

	vars := mux.Vars(r)
	evidencePublicID := vars["id"]

	// 1. Look up storage path
	var evidence models.Evidence
	err := h.Store.DB.Get(&evidence,
		`SELECT e.id, c.public_id AS case_id, e.storage_path
		 FROM evidence e
		 JOIN case_schema.cases c ON c.id = e.case_id
		 WHERE e.public_id = $1`,
		evidencePublicID,
	)
	if err != nil {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}

	// 2. Security Check only for user requests.
	if claims.TokenType == "user" {
		userPublicID, err := claims.GetSubject()
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusForbidden)
			return
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		hasAccess, err := services.CheckUserCaseAccess(evidence.CaseID, userPublicID, token)
		if err != nil || !hasAccess {
			http.Error(w, "Unauthorized", http.StatusForbidden)
			return
		}
	}

	// 3. Connect to S3 stream
	body, err := h.S3Client.DownloadFile(context.TODO(), evidence.StoragePath)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer body.Close()

	// 5. Pipe the binary stream directly to the response (No buffering)
	w.Header().Set("Content-Type", "application/octet-stream")
	io.Copy(w, body)
}

// ListEvidence returns all evidence for a given case
func (h *EvidenceHandler) ListEvidence(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := ctx.Value("claims").(*models.Claims)
	if !ok {
		http.Error(w, "Failed to get claims from the token", http.StatusInternalServerError)
		return
	}
	userPublicID := claims.Subject

	casePublicID := r.URL.Query().Get("case_id")
	if casePublicID == "" {
		http.Error(w, `{"error":"case_id query parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Extract token for inter-service calls
	token := r.Header.Get("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")

	// Validate case exists via case service
	caseResp, err := services.ValidateCase(casePublicID, token)
	if err != nil {
		log.Printf("Case validation failed: %v", err)
		http.Error(w, `{"error":"case not found or invalid"}`, http.StatusNotFound)
		return
	}

	// Check access control
	hasAccess, err := services.CheckUserCaseAccess(casePublicID, userPublicID, token)
	if err != nil || !hasAccess {
		http.Error(w, `{"error":"access denied: user not assigned to this case"}`, http.StatusForbidden)
		return
	}

	// Fetch evidence records
	var evidenceList []models.Evidence
	err = h.Store.DB.Select(&evidenceList,
		`SELECT e.id, e.public_id, c.public_id AS case_id, e.file_name, e.file_size,
		        e.storage_path, e.current_hash, e.uploaded_by, e.uploaded_at
		 FROM evidence e
		 JOIN case_schema.cases c ON c.id = e.case_id
		 WHERE e.case_id = $1
		 ORDER BY e.uploaded_at DESC`,
		caseResp.ID,
	)
	if err != nil {
		log.Printf("DB select error: %v", err)
		http.Error(w, `{"error":"failed to fetch evidence"}`, http.StatusInternalServerError)
		return
	}

	if evidenceList == nil {
		evidenceList = []models.Evidence{}
	} else {
		var evidenceIDs = make([]int64, len(evidenceList))
		for i, evidence := range evidenceList {
			evidenceIDs[i] = evidence.ID
		}

		auditClient := services.NewAuditClient()

		evidenceStatuses, err := auditClient.GetEvidenceStatus(ctx, evidenceIDs)
		if err != nil {
			log.Printf("Audit service call for evidence status failed, %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		evidenceStatusesMap := make(map[int64]models.EvidenceStatus)
		for _, evidence := range evidenceStatuses {
			evidenceStatusesMap[evidence.EvidenceID] = evidence
		}

		for i, evidence := range evidenceList {
			evidenceList[i].CurrentHash = evidenceStatusesMap[evidence.ID].CurrentHash
			evidenceList[i].Status = evidenceStatusesMap[evidence.ID].Status
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(evidenceList)
}
