package auth

type Permission string

const (
	USER_CREATE Permission = "USER_CREATE"
	USER_DELETE Permission = "USER_DELETE"
	USER_EDIT   Permission = "USER_EDIT"
	USER_VIEW   Permission = "USER_VIEW"

	EVIDENCE_CREATE   Permission = "EVIDENCE_CREATE"
	EVIDENCE_DELETE   Permission = "EVIDENCE_DELETE"
	EVIDENCE_VIEW     Permission = "EVIDENCE_VIEW"
	EVIDENCE_DOWNLOAD Permission = "EVIDENCE_DOWNLOAD"
	EVIDENCE_VERIFY   Permission = "EVIDENCE_VERIFY"
	EVIDENCE_ACCESS   Permission = "EVIDENCE_ACCESS"

	CASE_CREATE Permission = "CASE_CREATE"
	CASE_DELETE Permission = "CASE_DELETE"
	CASE_EDIT   Permission = "CASE_EDIT"
	CASE_VIEW   Permission = "CASE_VIEW"
	CASE_ASSIGN Permission = "CASE_ASSIGN"

	DEPARTMENT_CREATE Permission = "DEPARTMENT_CREATE"
	DEPARTMENT_DELETE Permission = "DEPARTMENT_DELETE"
	DEPARTMENT_EDIT   Permission = "DEPARTMENT_EDIT"
	DEPARTMENT_VIEW   Permission = "DEPARTMENT_VIEW"

	ROLE_CREATE Permission = "ROLE_CREATE"
	ROLE_DELETE Permission = "ROLE_DELETE"
	ROLE_EDIT   Permission = "ROLE_EDIT"
	ROLE_ASSIGN Permission = "ROLE_ASSIGN"
	ROLE_REVOKE Permission = "ROLE_REVOKE"

	PERMISSION_VIEW Permission = "PERMISSION_VIEW"

	ORG_MANAGE Permission = "ORG_MANAGE"

	LOG_VIEW Permission = "LOG_VIEW"
)

func (p Permission) String() string {
	return string(p)
}
