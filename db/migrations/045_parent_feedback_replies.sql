ALTER TABLE parent_feedback
  ADD COLUMN IF NOT EXISTS reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_by uuid REFERENCES users(id) ON DELETE SET NULL;

