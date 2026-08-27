package services

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type S3Client struct {
	Client *s3.Client
	Bucket string
}

// NewS3Client initializes a new S3 client using environment variables.
func NewS3Client() (*S3Client, error) {
	region := os.Getenv("AWS_REGION")
	accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	bucket := os.Getenv("AWS_S3_BUCKET")

	if region == "" || accessKey == "" || secretKey == "" || bucket == "" {
		return nil, fmt.Errorf("missing AWS configuration in environment variables")
	}

	// Use static credentials for now
	staticProvider := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
		config.WithCredentialsProvider(staticProvider),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load SDK config, %v", err)
	}

	client := s3.NewFromConfig(cfg)

	return &S3Client{
		Client: client,
		Bucket: bucket,
	}, nil
}

// UploadFile uploads a file to S3 and returns the S3 version ID (if versioning is enabled) and any error.
func (s *S3Client) UploadFile(ctx context.Context, key string, body io.Reader) (string, error) {
	out, err := s.Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.Bucket),
		Key:    aws.String(key),
		Body:   body,
	})
	if err != nil {
		return "", err
	}
	versionID := ""
	if out.VersionId != nil {
		versionID = *out.VersionId
	}
	return versionID, nil
}

// DownloadFile retrieves a file from S3 and returns a ReadCloser.
func (s *S3Client) DownloadFile(ctx context.Context, key string) (io.ReadCloser, error) {
	return s.DownloadFileVersion(ctx, key, "")
}

// DownloadFileVersion retrieves a specific version of a file from S3.
func (s *S3Client) DownloadFileVersion(ctx context.Context, key string, versionID string) (io.ReadCloser, error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(s.Bucket),
		Key:    aws.String(key),
	}
	if versionID != "" {
		input.VersionId = aws.String(versionID)
	}
	result, err := s.Client.GetObject(ctx, input)
	if err != nil {
		return nil, err
	}
	return result.Body, nil
}

// CopyVersion copies a specific historical version over the current key, creating a new current version.
func (s *S3Client) CopyVersion(ctx context.Context, key string, versionID string) (string, error) {
	copySource := fmt.Sprintf("%s/%s", s.Bucket, key)
	if versionID != "" {
		copySource = fmt.Sprintf("%s/%s?versionId=%s", s.Bucket, key, versionID)
	}
	out, err := s.Client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(s.Bucket),
		Key:        aws.String(key),
		CopySource: aws.String(copySource),
	})
	if err != nil {
		return "", err
	}
	newVersionID := ""
	if out.VersionId != nil {
		newVersionID = *out.VersionId
	}
	return newVersionID, nil
}

// ListObjectVersions retrieves all versions of an object in the S3 bucket.
func (s *S3Client) ListObjectVersions(ctx context.Context, key string) ([]types.ObjectVersion, error) {
	out, err := s.Client.ListObjectVersions(ctx, &s3.ListObjectVersionsInput{
		Bucket: aws.String(s.Bucket),
		Prefix: aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	return out.Versions, nil
}
