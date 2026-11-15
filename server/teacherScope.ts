import type { SessionUser } from "@/types/domain";
import { query } from "./db";
import { AppError } from "./errors";

export type TeacherScope = {
  branchId: string;
  className: string;
};

/**
 * Resolves a teacher's data boundary from their login and staff record.
 * Matching by tenant + login email keeps the scope attached to the actual
 * account while the staff record remains the source of campus/class details.
 */
export async function requireTeacherScope(user: SessionUser): Promise<TeacherScope | null> {
  if (user.role !== "TEACHER") return null;
  const result = await query<TeacherScope>(
    `SELECT u.branch_id AS "branchId",team.title AS "className"
     FROM users u
     LEFT JOIN LATERAL (
       SELECT member.title
       FROM team_members member
       WHERE member.tenant_id=u.tenant_id
         AND member.branch_id=u.branch_id
         AND lower(member.contact_email::text)=lower(u.email::text)
       ORDER BY member.updated_at DESC,member.created_at DESC
       LIMIT 1
     ) team ON true
     WHERE u.id=$1 AND u.tenant_id=$2 AND u.is_active=true
     LIMIT 1`,
    [user.id, user.tenantId],
  );
  const scope = result.rows[0];
  if (!scope?.branchId || !scope.className?.trim()) {
    throw new AppError(
      403,
      "TEACHER_SCOPE_REQUIRED",
      "This teacher login is not linked to a campus and class. Match the login email to the teacher profile and assign a campus before continuing.",
    );
  }
  const title=scope.className.trim();
  // Staff titles may include a friendly programme label, for example
  // "Stage 4 — Grade 0". Keep the data boundary on the canonical class token.
  const canonical=title.match(/\b(?:stage|grade)\s*[_-]?\s*[a-z0-9]+\b/i)?.[0]??title;
  return { branchId: scope.branchId, className: canonical.trim() };
}

