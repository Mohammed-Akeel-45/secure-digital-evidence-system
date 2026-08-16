package models

type Organisation struct {
	ID       int64  `db:"id"`
	PublicID string `db:"public_id"`
	Name     string `db:"name"`
}
