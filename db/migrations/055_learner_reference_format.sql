WITH reference_parts AS (
  SELECT
    a.id,
    a.tenant_id,
    a.created_at,
    CASE
      WHEN lower(b.name) LIKE '%hebron%' THEN 'H1'
      WHEN lower(b.name) LIKE '%mamelodi%' THEN 'M1'
      WHEN lower(b.name) LIKE '%soshanguve%' THEN 'S1'
      WHEN lower(b.name) LIKE '%thembisa%' OR lower(b.name) LIKE '%tembisa%' THEN 'T1'
      WHEN lower(b.name) LIKE '%sky%' THEN 'SC1'
      WHEN lower(b.name) LIKE '%soweto%' THEN 'S2'
      ELSE upper(left(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g'), 4))
    END
    || COALESCE((
      SELECT string_agg(upper(left(regexp_replace(part, '[^a-zA-Z0-9]', '', 'g'), 1)), '' ORDER BY ordinal)
      FROM unnest(regexp_split_to_array(trim(a.child_name), E'[\\s-]+')) WITH ORDINALITY AS name_part(part, ordinal)
    ), 'XX')
    || to_char(a.child_date_of_birth, 'DDMMYY') AS base_reference
  FROM applications a
  JOIN application_preferences p ON p.application_id = a.id
  JOIN branches b ON b.id = p.branch_id
), ranked AS (
  SELECT *, row_number() OVER (
    PARTITION BY tenant_id, base_reference
    ORDER BY created_at, id
  ) AS duplicate_number
  FROM reference_parts
)
UPDATE applications a
SET reference = CASE
      WHEN ranked.duplicate_number = 1 THEN ranked.base_reference
      ELSE ranked.base_reference || '-' || ranked.duplicate_number::text
    END,
    updated_at = now()
FROM ranked
WHERE a.id = ranked.id;
