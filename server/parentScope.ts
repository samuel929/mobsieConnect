import type { ParentSession } from "@/server/parentAuth";
import { query } from "@/server/db";

/**
 * Resolves the branch IDs a parent may read.  The scope is derived from their
 * own applications and learners; it must never be supplied by the mobile app.
 */
export async function getParentBranchIds(parent: Pick<ParentSession, "id" | "tenantId" | "name" | "email" | "phone">) {
  const result = await query<{ branchId: string }>(
    `SELECT DISTINCT s.branch_id AS "branchId"
       FROM students s
       LEFT JOIN applications a ON a.id = s.application_id
      WHERE s.tenant_id=$1
        AND s.branch_id IS NOT NULL
        AND (
          a.parent_account_id=$2
          OR lower(trim(s.parent_name))=lower(trim($3))
          OR lower(trim(COALESCE(a.parent_email, '')))=lower(trim($4))
          OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g') = regexp_replace($5, '\\D', '', 'g')
        )
     UNION
     SELECT DISTINCT p.branch_id AS "branchId"
       FROM applications a
       JOIN application_preferences p ON p.application_id=a.id
      WHERE a.tenant_id=$1
        AND (
          a.parent_account_id=$2
          OR lower(trim(COALESCE(a.parent_name, '')))=lower(trim($3))
          OR lower(trim(COALESCE(a.parent_email, '')))=lower(trim($4))
          OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g') = regexp_replace($5, '\\D', '', 'g')
        )
        AND p.branch_id IS NOT NULL`,
    [parent.tenantId, parent.id, parent.name, parent.email, parent.phone],
  );
  return result.rows.map((row) => row.branchId);
}

export type ParentEventRange = { from?: string; to?: string };

export async function getParentEvents(
  parent: Pick<ParentSession, "id" | "tenantId" | "name" | "email" | "phone">,
  range: ParentEventRange = {},
) {
  const branchIds = await getParentBranchIds(parent);
  const result = await query(
    `SELECT e.id,e.branch_id AS "branchId",b.name AS "branchName",e.title,e.description,
            e.category,e.starts_at::text AS "startsAt",e.ends_at::text AS "endsAt",e.all_day AS "allDay"
       FROM calendar_events e
       LEFT JOIN branches b ON b.id=e.branch_id
      WHERE e.tenant_id=$1
        AND (e.branch_id IS NULL OR e.branch_id = ANY($2::uuid[]))
        AND ($3::timestamptz IS NULL OR e.ends_at >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR e.starts_at < $4::timestamptz)
      ORDER BY e.starts_at ASC, e.id ASC
      LIMIT 100`,
    [parent.tenantId, branchIds, range.from ?? null, range.to ?? null],
  );
  return result.rows;
}
