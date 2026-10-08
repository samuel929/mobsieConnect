-- Payment receipts are stored alongside the rest of an application document set.
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'PROOF_OF_PAYMENT';

-- Supports the detail view that retrieves a submitted application's document set.
CREATE INDEX IF NOT EXISTS idx_application_documents_application_uploaded
  ON application_documents (application_id, uploaded_at DESC);
