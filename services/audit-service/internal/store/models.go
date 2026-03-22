package store

type EvidenceDetails struct {
	EvidenceID       int64
	EvidencePublicID string
	Algorithm        string
	FileHash         string
}

type EvidenceRegistrationDetails struct {
	EvidenceID       int64
	EvidencePublicID string
	Algorithm        string
	FileHash         string
	CaseID           int64
	UserID           int64
	ActionType       int32
	Remarks          string
	// jsonb data
	ActionMetadata string
	ServiceName    string
	IPAddress      string
}

type CustodyLog struct {
	EvidenceID int64
	CaseID     int64
	UserID     int64
	ActionType int32
	Remarks    string
	// jsonb data
	ActionMetadata string
}

type AuditLog struct {
	UserID      int64
	CaseID      int64
	EvidenceId  int64
	ActionType  int32
	ServiceName string
	IPAddress   string
}

func (d *EvidenceRegistrationDetails) ToCustodyLog() CustodyLog {
	return CustodyLog{
		EvidenceID: d.EvidenceID,
		CaseID:     d.CaseID,
		UserID:     d.UserID,
		ActionType: d.ActionType,
		Remarks:    d.Remarks,
		// jsonb data
		ActionMetadata: d.ActionMetadata,
	}
}

func (d *EvidenceRegistrationDetails) ToAuditLog() AuditLog {
	return AuditLog{
		UserID:      d.UserID,
		CaseID:      d.CaseID,
		EvidenceId:  d.EvidenceID,
		ActionType:  d.ActionType,
		ServiceName: d.ServiceName,
		IPAddress:   d.IPAddress,
	}
}

func (d *EvidenceRegistrationDetails) ToEvidenceDetails() EvidenceDetails {
	return EvidenceDetails{
		EvidenceID:       d.EvidenceID,
		EvidencePublicID: d.EvidencePublicID,
		Algorithm:        d.Algorithm,
		FileHash:         d.FileHash,
	}
}
