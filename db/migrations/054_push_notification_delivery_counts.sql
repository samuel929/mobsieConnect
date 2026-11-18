ALTER TABLE mobile_notifications
  ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN mobile_notifications.sent_count IS
  'Number of device tickets accepted by Expo for this notification.';

COMMENT ON COLUMN mobile_notifications.failed_count IS
  'Number of device tickets rejected or failed while sending this notification.';
