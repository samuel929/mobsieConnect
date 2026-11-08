-- Align existing Mamelodi onboarding applications with the official 2027
-- campus-specific fee structure. Future saves are handled by the preferences
-- API using the same branch pricing table.
UPDATE application_preferences AS preferences
SET
  application_fee_cents = 95000,
  acceptance_fee_cents = 0,
  monthly_fee_cents = CASE preferences.school_stage
    WHEN 'STAGE_1' THEN 150000
    WHEN 'STAGE_2' THEN 130000
    WHEN 'STAGE_3' THEN 130000
    WHEN 'STAGE_4' THEN 110000
    WHEN 'GRADE_R' THEN 110000
    ELSE preferences.monthly_fee_cents
  END,
  updated_at = now()
FROM branches
WHERE preferences.branch_id = branches.id
  AND lower(regexp_replace(branches.name, '[^a-z]', '', 'g')) LIKE '%mamelodi%';
