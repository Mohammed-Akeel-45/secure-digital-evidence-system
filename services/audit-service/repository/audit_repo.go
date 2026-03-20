package repository

import (
	"audit-service/internal/store"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strconv"

	"github.com/jackc/pgx/v5"
)

type auditRepo struct{}

func NewAuditRepo() AuditRepo {
	return &auditRepo{}
}

func hashRowContents(row store.AuditLog, prevRowHash string) string {
	concatenatedRow := strconv.Itoa(int(row.UserID)) + strconv.Itoa(int(row.CaseID)) + strconv.Itoa(int(row.EvidenceId)) + strconv.Itoa(int(row.ActionType)) + row.ServiceName + row.IPAddress + prevRowHash

	hash := sha256.Sum256([]byte(concatenatedRow))
	hashString := hex.EncodeToString(hash[:])
	return hashString
}

func (a auditRepo) InsertAuditLog(ctx context.Context, tx pgx.Tx, auditLog store.AuditLog) error {
	var prevRowHash string
	// Get the previous hash for the same evidence from the database. `FOR UPDATE` ensures that the row is locked for the duration of the transaction.
	row := tx.QueryRow(ctx, `
			SELECT current_hash
			FROM integrity_schema.audit_logs
			WHERE evidence_id = @evidenceID
			ORDER BY created_at DESC LIMIT 1;
			FOR UPDATE
		`, pgx.NamedArgs{"evidenceID": auditLog.EvidenceId})

	if err := row.Scan(&prevRowHash); err != nil {
		// no previous row found
		prevRowHash = ""
	}

	newHash := hashRowContents(auditLog, prevRowHash)

	_, err := tx.Exec(ctx, `
			INSERT INTO integrity_schema.audit_logs(user_id, case_id, evidence_id, action_type, service_name, ip_address, previous_hash, current_hash)
			VALUES(@userID, @caseID, @evidenceID, @actionType, @serviceName, @ipAdress, @previousHash, @currentHash)
		`,
		pgx.NamedArgs{"userID": auditLog.UserID, "caseID": auditLog.CaseID, "evidenceID": auditLog.EvidenceId,
			"actionType": auditLog.ActionType, "serviceName": auditLog.ServiceName, "ipAdress": auditLog.IPAddress,
			"previousHash": prevRowHash, "currentHash": newHash})

	return err
}
