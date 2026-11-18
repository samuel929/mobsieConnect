ALTER TABLE application_documents
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reupload_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_application_documents_reupload_required
  ON application_documents (application_id, reupload_requested_at)
  WHERE review_status = 'REJECTED';
