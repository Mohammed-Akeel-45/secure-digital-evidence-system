package models

type ResolvedCase struct {
	PublicID string `json:"public_id"`
	Name     string `json:"title"`
	ID       int64  `json:"id"`
}

type CasePublicIDNamePair struct {
	PublicID string
	Name     string
}

type CaseDetails struct {
	ID     int64 `json:"id"`
	OrgID  int64 `json:"org_id"`
	DeptID int64 `json:"dept_id"`
}
