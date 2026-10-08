ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS waiting_list_email_sent_at timestamptz;
