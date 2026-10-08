CREATE TABLE IF NOT EXISTS daily_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  class_name text,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_time time NOT NULL,
  end_time time NOT NULL,
  repeat_rule text NOT NULL DEFAULT 'EVERY_DAY',
  icon text NOT NULL DEFAULT 'clock',
  color text NOT NULL DEFAULT '#45C990',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_activity_type_valid CHECK (
    activity_type IN ('DROP_OFF','ASSEMBLY','LESSON','SNACK','READING','LUNCH','CUSTOM')
  ),
  CONSTRAINT daily_activity_repeat_valid CHECK (
    repeat_rule IN (
      'EVERY_DAY','WEEKDAYS','MONDAY','TUESDAY','WEDNESDAY','THURSDAY',
      'FRIDAY','SATURDAY','SUNDAY'
    )
  ),
  CONSTRAINT daily_activity_time_valid CHECK (end_time > start_time),
  CONSTRAINT daily_activity_order_valid CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_daily_activities_tenant_schedule
  ON daily_activities (tenant_id, is_active, start_time, display_order, id);

CREATE INDEX IF NOT EXISTS idx_daily_activities_mobile_feed
  ON daily_activities (tenant_id, branch_id, class_name, start_time)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS set_daily_activities_updated_at ON daily_activities;
CREATE TRIGGER set_daily_activities_updated_at
  BEFORE UPDATE ON daily_activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Preserve valid timetables created by older dashboard builds, where daily
-- activities lived inside control_centre_state.state JSON.
INSERT INTO daily_activities (
  tenant_id, branch_id, class_name, activity_type, title, description,
  start_time, end_time, repeat_rule, icon, color, display_order
)
SELECT
  state.tenant_id,
  branch.id,
  NULLIF(activity.value->>'className', 'ALL'),
  CASE activity.value->>'activityType'
    WHEN 'DROP_OFF' THEN 'DROP_OFF'
    WHEN 'ASSEMBLY' THEN 'ASSEMBLY'
    WHEN 'LESSON' THEN 'LESSON'
    WHEN 'SNACK' THEN 'SNACK'
    WHEN 'READING' THEN 'READING'
    WHEN 'LUNCH' THEN 'LUNCH'
    ELSE 'CUSTOM'
  END,
  activity.value->>'title',
  COALESCE(activity.value->>'description', activity.value->>'detail', ''),
  (activity.value->>'startTime')::time,
  (activity.value->>'endTime')::time,
  CASE activity.value->>'repeat'
    WHEN 'WEEKDAYS' THEN 'WEEKDAYS'
    WHEN 'MONDAY' THEN 'MONDAY'
    WHEN 'TUESDAY' THEN 'TUESDAY'
    WHEN 'WEDNESDAY' THEN 'WEDNESDAY'
    WHEN 'THURSDAY' THEN 'THURSDAY'
    WHEN 'FRIDAY' THEN 'FRIDAY'
    WHEN 'SATURDAY' THEN 'SATURDAY'
    WHEN 'SUNDAY' THEN 'SUNDAY'
    ELSE 'EVERY_DAY'
  END,
  COALESCE(NULLIF(activity.value->>'icon', ''), 'clock'),
  CASE WHEN COALESCE(activity.value->>'color', '') ~ '^#[0-9A-Fa-f]{6}$'
    THEN activity.value->>'color' ELSE '#45C990' END,
  (activity.ordinality - 1)::integer
FROM control_centre_state state
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(state.state->'dailyActivities') = 'array'
    THEN state.state->'dailyActivities' ELSE '[]'::jsonb END
) WITH ORDINALITY AS activity(value, ordinality)
LEFT JOIN branches branch
  ON branch.tenant_id = state.tenant_id
 AND branch.id::text = activity.value->>'branchId'
WHERE COALESCE(activity.value->>'title', '') <> ''
  AND COALESCE(activity.value->>'startTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND COALESCE(activity.value->>'endTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND (activity.value->>'endTime')::time > (activity.value->>'startTime')::time;
