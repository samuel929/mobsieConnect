ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS interview_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_email_sent_at timestamptz;
