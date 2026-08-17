package service

import (
	"context"
	"io"
)

type FileFetcher interface {
	GetFile(ctx context.Context, evidenceID string, authToken string) (io.ReadCloser, error)
}
