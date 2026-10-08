-- Existing databases may already have mobile_notifications from an earlier
-- migration. CREATE TABLE IF NOT EXISTS does not add newly introduced fields.
-- Make the notification payload additive and safe to run repeatedly.
ALTER TABLE mobile_notifications
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
