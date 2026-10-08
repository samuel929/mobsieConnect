ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS approval_email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_applications_approval_email_pending
  ON applications (tenant_id, updated_at DESC)
  WHERE status = 'APPROVED' AND approval_email_sent_at IS NULL;