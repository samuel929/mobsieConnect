-- This must be a new migration rather than an edit to migration 011: deployed
-- databases never rerun an already-recorded migration.
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'PARENT_ID_SECONDARY';
