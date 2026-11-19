-- Repair older/manual applications that pre-date parent-account linking.
-- Email matching is tenant-scoped and parent_accounts enforces unique emails.
UPDATE applications a
SET parent_account_id = p.id,
    updated_at = now()
FROM parent_accounts p
WHERE a.parent_account_id IS NULL
  AND p.tenant_id = a.tenant_id
  AND lower(trim(p.email::text)) = lower(trim(a.parent_email::text));

-- Approved applications must have a learner row before the parent app can
-- offer learner-scoped actions such as deregistration.
INSERT INTO students (
  tenant_id, branch_id, application_id, parent_account_id,
  name, date_of_birth, grade, class_name, parent_name, enrollment_status
)
SELECT
  a.tenant_id, ap.branch_id, a.id, a.parent_account_id,
  a.child_name, a.child_date_of_birth, a.current_grade, a.current_grade,
  a.parent_name, 'ENROLLED'
FROM applications a
JOIN application_preferences ap ON ap.application_id = a.id
WHERE a.status IN ('APPROVED', 'ENROLLED')
  AND a.parent_account_id IS NOT NULL
ON CONFLICT (application_id) DO UPDATE SET
  branch_id = EXCLUDED.branch_id,
  parent_account_id = EXCLUDED.parent_account_id,
  name = EXCLUDED.name,
  date_of_birth = EXCLUDED.date_of_birth,
  grade = EXCLUDED.grade,
  parent_name = EXCLUDED.parent_name,
  enrollment_status = 'ENROLLED',
  updated_at = now();

UPDATE students s
SET parent_account_id = a.parent_account_id,
    updated_at = now()
FROM applications a
WHERE s.application_id = a.id
  AND a.parent_account_id IS NOT NULL
  AND s.parent_account_id IS DISTINCT FROM a.parent_account_id;
