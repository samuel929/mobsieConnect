-- Mobsie Kids 2026 registration documents required by the official form.
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'LEARNER_PHOTO';
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'PARENT_ID_SECONDARY';
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'CLINIC_CARD';
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'PROOF_OF_INCOME';
