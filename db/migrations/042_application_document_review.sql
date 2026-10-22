ALTER TABLE application_documents
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE application_documents
    ADD CONSTRAINT application_documents_review_status_check
    CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_application_documents_review
  ON application_documents (application_id, review_status);
