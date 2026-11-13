-- Dedicated permissions let teachers use Messages and Daily Activity without
-- implicitly granting the broader Communications or Manage Teachers areas.
INSERT INTO dashboard_role_permissions (role_id, permission_key, granted)
SELECT r.id, permission.permission_key,
  CASE
    WHEN r.name IN ('Super Admin', 'School Owner', 'Branch Principal', 'Teacher') THEN true
    WHEN r.name = 'Admissions' AND permission.permission_key = 'Messages' THEN true
    ELSE false
  END
FROM dashboard_roles r
CROSS JOIN (VALUES ('Daily activities'), ('Messages')) AS permission(permission_key)
ON CONFLICT (role_id, permission_key) DO NOTHING;
