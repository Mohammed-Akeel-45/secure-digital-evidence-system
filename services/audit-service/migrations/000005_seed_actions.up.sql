INSERT INTO integrity_schema.actions (name, description) VALUES
    ('UPLOAD', 'Upload digital evidence file'),
    ('VIEW', 'View digital evidence details or stream'),
    ('VERIFY', 'Verify cryptographic integrity of evidence'),
    ('DOWNLOAD', 'Download digital evidence file')
ON CONFLICT (name) DO NOTHING;
