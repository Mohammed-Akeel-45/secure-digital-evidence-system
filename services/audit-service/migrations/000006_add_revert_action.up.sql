INSERT INTO integrity_schema.actions (name, description) 
VALUES ('REVERT', 'Revert evidence to previous known good version')
ON CONFLICT (name) DO NOTHING;
