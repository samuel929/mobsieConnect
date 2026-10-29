ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS transport_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transport_route text;
