INSERT INTO auth_schema.permissions (name, description)
VALUES
    ('USER_CREATE',        'Create new user accounts within the organization.'),
    ('USER_DELETE',        'Delete existing user accounts from the organization.'),
    ('USER_EDIT',          'Modify user profile information and account settings.'),
    ('USER_VIEW',          'View user information and profiles.'),

    ('EVIDENCE_CREATE',    'Upload and register new digital evidence.'),
    ('EVIDENCE_DELETE',    'Delete or permanently remove digital evidence.'),
    ('EVIDENCE_VIEW',      'View digital evidence metadata.'),
    ('EVIDENCE_DOWNLOAD',  'Download evidence files from secure storage.'),
    ('EVIDENCE_VERIFY',    'Verify the integrity of evidence using cryptographic hashes.'),
    ('EVIDENCE_ACCESS',    'Request or grant access to restricted evidence.'),

    ('CASE_CREATE',        'Create new investigation cases.'),
    ('CASE_DELETE',        'Delete existing investigation cases.'),
    ('CASE_EDIT',          'Modify case information and details.'),
    ('CASE_VIEW',          'View case information and associated records.'),
    ('CASE_ASSIGN',        'Assign users to investigation cases.'),

    ('DEPARTMENT_CREATE',  'Create new organizational departments.'),
    ('DEPARTMENT_DELETE',  'Delete existing organizational departments.'),
    ('DEPARTMENT_EDIT',    'Modify department information and settings.'),
    ('DEPARTMENT_VIEW',    'View department information.'),

    ('ROLE_CREATE',        'Create new RBAC roles.'),
    ('ROLE_DELETE',        'Delete existing RBAC roles.'),
    ('ROLE_EDIT',          'Modify role definitions and associated permissions.'),
    ('ROLE_ASSIGN',        'Assign roles to users.'),
    ('ROLE_REVOKE',        'Revoke assigned roles from users.'),

    ('PERMISSION_VIEW',    'View available system permissions.'),

    ('ORG_MANAGE',         'Manage organization settings, configuration, and members.'),

    ('LOG_VIEW',           'View audit logs, chain-of-custody records, and system activity logs.')
ON CONFLICT (name) DO NOTHING;
