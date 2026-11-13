CREATE TABLE IF NOT EXISTS dashboard_notification_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_notification_reads_user
  ON dashboard_notification_reads (user_id, read_at DESC);
