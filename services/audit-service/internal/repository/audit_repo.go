package repository

import (
	"audit-service/internal/cerrors"
	"audit-service/internal/store"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type auditRepo struct {
	store *store.Storage
}

func NewAuditRepo(store *store.Storage) AuditRepo {
	return &auditRepo{store: store}
}

// Returns a querier for the database.
func (a *auditRepo) q(ctx context.Context) store.PgxQuerier {
	tx := store.ExtractTx(ctx)
	if tx != nil {
		return tx // Use the transaction passed down via the context.
	}
	return a.store.Pool // No transaction passed, use the database.
}

func cleanIP(ipStr string) string {
	ipStr = strings.TrimSpace(ipStr)
	if host, _, err := net.SplitHostPort(ipStr); err == nil {
		return host
	}
	if ipStr == "" {
		return "127.0.0.1"
	}
	return ipStr
}

func hashRowContents(row store.AuditLog, prevRowHash string) string {
	concatenatedRow := strconv.Itoa(int(row.UserID)) + strconv.Itoa(int(row.CaseID)) + strconv.Itoa(int(row.EvidenceId)) + strconv.Itoa(int(row.ActionType)) + row.ServiceName + row.IPAddress + prevRowHash

	hash := sha256.Sum256([]byte(concatenatedRow))
	hashString := hex.EncodeToString(hash[:])
	return hashString
}

func (a auditRepo) InsertAuditLog(ctx context.Context, auditLog store.AuditLog) error {
	auditLog.IPAddress = cleanIP(auditLog.IPAddress)
	var prevRowHash string
	// Query to get the previous hash for the same evidence.
	getPrevHashQuery := `
			SELECT current_hash
			FROM integrity_schema.audit_logs
			WHERE evidence_id = @evidenceID
			ORDER BY created_at DESC LIMIT 1
			FOR UPDATE
		`
	prevHashArgs := pgx.NamedArgs{"evidenceID": auditLog.EvidenceId}

	// Get the previous hash for the same evidence from the database. `FOR UPDATE` ensures that the row is locked for the duration of the transaction.
	row := a.q(ctx).QueryRow(ctx, getPrevHashQuery, prevHashArgs)

	if err := row.Scan(&prevRowHash); err != nil {
		// no previous row found
		prevRowHash = ""
	}

	// Calculate the new hash for the row.
	newHash := hashRowContents(auditLog, prevRowHash)

	status := auditLog.Status
	if status == "" {
		status = "unchanged"
	}

	var detailsJSON []byte
	if auditLog.Details != "" {
		detailsJSON = []byte(auditLog.Details)
	}

	// Query to insert the new row into the database.
	query := `
			INSERT INTO integrity_schema.audit_logs(
				user_id, case_id, evidence_id, action_type, service_name, ip_address, previous_hash, current_hash, request_id, status, details
			)
			VALUES(
				@userID, @caseID, @evidenceID, @actionType, @serviceName, @ipAddress, @previousHash, @currentHash, @requestID, @status, @details
			)
		`
	args := pgx.NamedArgs{
		"userID":       auditLog.UserID,
		"caseID":       auditLog.CaseID,
		"evidenceID":   auditLog.EvidenceId,
		"actionType":   auditLog.ActionType,
		"serviceName":  auditLog.ServiceName,
		"ipAddress":    auditLog.IPAddress,
		"previousHash": prevRowHash,
		"currentHash":  newHash,
		"requestID":    auditLog.RequestID,
		"status":       status,
		"details":      detailsJSON,
	}

	// Execute the query.
	_, err := a.q(ctx).Exec(ctx, query, args)
	// Send meaningful error to the service layer.
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case cerrors.ErrForeignKeyViolation.Code:
				return cerrors.ErrForeignKeyViolation.Error
			case cerrors.ErrNotNullViolation.Code:
				return cerrors.ErrNotNullViolation.Error
			case cerrors.ErrEvidenceAlreadyExists.Code:
				return cerrors.ErrEvidenceAlreadyExists.Error
			}
		}
		// Error is either not a pgconn.PgError or the error code does not match the expected error code.
		log.Printf("error: failed to insert audit log, %v", err)
		return fmt.Errorf("error: failed to insert audit log, %w", err)
	}

	return nil
}

func (a *auditRepo) ListAuditLogs(ctx context.Context, evidenceID string, caseID string, limit int, offset int) ([]store.AuditLogDTO, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT 
			al.public_id::text,
			COALESCE(eh.evidence_public_id::text, ''),
			al.evidence_id,
			al.case_id,
			al.user_id,
			COALESCE(al.request_id::text, ''),
			COALESCE(al.previous_hash, ''),
			al.current_hash,
			COALESCE(a.name, 'UNKNOWN'),
			al.service_name,
			al.ip_address::text,
			al.status::text,
			al.details,
			al.created_at
		FROM integrity_schema.audit_logs al
		LEFT JOIN integrity_schema.actions a ON al.action_type = a.id
		LEFT JOIN integrity_schema.evidence_hashes eh ON al.evidence_id = eh.evidence_id
		WHERE (@evidenceID = '' OR eh.evidence_public_id::text = @evidenceID OR al.evidence_id::text = @evidenceID)
		  AND (@caseID = '' OR al.case_id::text = @caseID)
		ORDER BY al.created_at DESC
		LIMIT @limit OFFSET @offset
	`

	args := pgx.NamedArgs{
		"evidenceID": evidenceID,
		"caseID":     caseID,
		"limit":      limit,
		"offset":     offset,
	}

	rows, err := a.q(ctx).Query(ctx, query, args)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []store.AuditLogDTO
	for rows.Next() {
		var l store.AuditLogDTO
		var detailsJSON []byte
		err := rows.Scan(
			&l.PublicID,
			&l.EvidencePublicID,
			&l.EvidenceID,
			&l.CaseID,
			&l.UserID,
			&l.RequestID,
			&l.PreviousHash,
			&l.CurrentHash,
			&l.Action,
			&l.ServiceName,
			&l.IPAddress,
			&l.Status,
			&detailsJSON,
			&l.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log row: %w", err)
		}
		if len(detailsJSON) > 0 {
			var details map[string]any
			if err := json.Unmarshal(detailsJSON, &details); err == nil {
				l.Details = details
				if fn, ok := details["file_name"].(string); ok {
					l.EvidenceName = fn
				}
				if ct, ok := details["case_title"].(string); ok {
					l.CaseTitle = ct
				}
				if un, ok := details["user_name"].(string); ok {
					l.UserName = un
				}
				if cp, ok := details["case_public_id"].(string); ok {
					l.CasePublicID = cp
				}
				if up, ok := details["user_public_id"].(string); ok {
					l.UserPublicID = up
				}
			}
		}
		logs = append(logs, l)
	}

	if logs == nil {
		logs = []store.AuditLogDTO{}
	}

	return logs, nil
}

func (a *auditRepo) GetAuditLogByID(ctx context.Context, id string) (*store.AuditLogDTO, error) {
	query := `
		SELECT 
			al.public_id::text,
			COALESCE(eh.evidence_public_id::text, ''),
			al.evidence_id,
			al.case_id,
			al.user_id,
			COALESCE(al.request_id::text, ''),
			COALESCE(al.previous_hash, ''),
			al.current_hash,
			COALESCE(a.name, 'UNKNOWN'),
			al.service_name,
			al.ip_address::text,
			al.status::text,
			al.details,
			al.created_at
		FROM integrity_schema.audit_logs al
		LEFT JOIN integrity_schema.actions a ON al.action_type = a.id
		LEFT JOIN integrity_schema.evidence_hashes eh ON al.evidence_id = eh.evidence_id
		WHERE al.public_id::text = @id OR al.id::text = @id OR al.request_id::text = @id
		LIMIT 1
	`

	args := pgx.NamedArgs{
		"id": id,
	}

	var l store.AuditLogDTO
	var detailsJSON []byte

	err := a.q(ctx).QueryRow(ctx, query, args).Scan(
		&l.PublicID,
		&l.EvidencePublicID,
		&l.EvidenceID,
		&l.CaseID,
		&l.UserID,
		&l.RequestID,
		&l.PreviousHash,
		&l.CurrentHash,
		&l.Action,
		&l.ServiceName,
		&l.IPAddress,
		&l.Status,
		&detailsJSON,
		&l.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("audit log not found")
		}
		return nil, fmt.Errorf("failed to get audit log by id: %w", err)
	}

	if len(detailsJSON) > 0 {
		var details map[string]any
		if err := json.Unmarshal(detailsJSON, &details); err == nil {
			l.Details = details
			if fn, ok := details["file_name"].(string); ok {
				l.EvidenceName = fn
			}
			if ct, ok := details["case_title"].(string); ok {
				l.CaseTitle = ct
			}
			if un, ok := details["user_name"].(string); ok {
				l.UserName = un
			}
			if cp, ok := details["case_public_id"].(string); ok {
				l.CasePublicID = cp
			}
			if up, ok := details["user_public_id"].(string); ok {
				l.UserPublicID = up
			}
		}
	}

	return &l, nil
}

func (a *auditRepo) GetLatestAuditLogByEvidenceID(ctx context.Context, evidenceID int64) (*store.AuditLogDTO, error) {
	query := `
		SELECT 
			al.public_id,
			eh.evidence_public_id,
			al.evidence_id,
			al.case_id,
			al.user_id,
			al.request_id,
			COALESCE(al.previous_hash, ''),
			al.current_hash,
			COALESCE(act.name, 'UNKNOWN'),
			al.service_name,
			al.ip_address::text,
			al.status::text,
			al.details,
			al.created_at
		FROM integrity_schema.audit_logs al
		LEFT JOIN integrity_schema.actions act ON al.action_type = act.id
		LEFT JOIN integrity_schema.evidence_hashes eh ON al.evidence_id = eh.evidence_id
		WHERE al.evidence_id = @evidenceID
		ORDER BY al.created_at DESC
		LIMIT 1
	`

	args := pgx.NamedArgs{"evidenceID": evidenceID}
	var l store.AuditLogDTO
	var detailsJSON []byte
	err := a.q(ctx).QueryRow(ctx, query, args).Scan(
		&l.PublicID,
		&l.EvidencePublicID,
		&l.EvidenceID,
		&l.CaseID,
		&l.UserID,
		&l.RequestID,
		&l.PreviousHash,
		&l.CurrentHash,
		&l.Action,
		&l.ServiceName,
		&l.IPAddress,
		&l.Status,
		&detailsJSON,
		&l.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if len(detailsJSON) > 0 {
		var details map[string]any
		if err := json.Unmarshal(detailsJSON, &details); err == nil {
			l.Details = details
			if fn, ok := details["file_name"].(string); ok {
				l.EvidenceName = fn
			}
			if ct, ok := details["case_title"].(string); ok {
				l.CaseTitle = ct
			}
			if un, ok := details["user_name"].(string); ok {
				l.UserName = un
			}
			if cp, ok := details["case_public_id"].(string); ok {
				l.CasePublicID = cp
			}
			if up, ok := details["user_public_id"].(string); ok {
				l.UserPublicID = up
			}
		}
	}

	return &l, nil
}

func (a *auditRepo) GetOriginalEvidenceHash(ctx context.Context, evidenceID int64) (string, error) {
	// First query the earliest UPLOAD audit log details for the evidence
	query := `
		SELECT 
			COALESCE(al.details->>'file_hash', al.details->>'original_hash', al.details->>'stored_hash', '') AS original_hash
		FROM integrity_schema.audit_logs al
		JOIN integrity_schema.actions act ON al.action_type = act.id
		WHERE al.evidence_id = @evidenceID AND act.name = 'UPLOAD'
		ORDER BY al.id ASC
		LIMIT 1
	`
	args := pgx.NamedArgs{"evidenceID": evidenceID}
	var hash string
	err := a.q(ctx).QueryRow(ctx, query, args).Scan(&hash)
	if err == nil && hash != "" {
		return hash, nil
	}

	// Fallback to earliest audit log for that evidence file
	fallbackQuery := `
		SELECT 
			COALESCE(al.details->>'file_hash', al.details->>'original_hash', al.details->>'stored_hash', '') AS original_hash
		FROM integrity_schema.audit_logs al
		WHERE al.evidence_id = @evidenceID
		ORDER BY al.id ASC
		LIMIT 1
	`
	err = a.q(ctx).QueryRow(ctx, fallbackQuery, args).Scan(&hash)
	if err == nil && hash != "" {
		return hash, nil
	}

	return "", nil
}
