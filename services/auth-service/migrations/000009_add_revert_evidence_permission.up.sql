INSERT INTO auth_schema.permissions (name, description)
VALUES     
    ('REVERT_EVIDENCE',    'Revert tampered evidence to previous known-good version.')
ON CONFLICT (name) DO NOTHING;
