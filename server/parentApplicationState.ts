import { query } from "./db";
import type { ParentSession } from "./parentAuth";

export type ParentAccessState =
  | "NO_APPLICATION"
  | "APPLICATION_IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "APPROVED";

export type ParentUser = ParentSession & {
  applicationStatus: string | null;
  applicationReference: string | null;
  accessState: ParentAccessState;
};

export async function withParentApplicationState(parent: ParentSession): Promise<ParentUser> {
  const result = await query<{ status: string; reference: string; enrollmentComplete: boolean }>(
    `SELECT a.status::text AS status, a.reference,
            EXISTS(SELECT 1 FROM mobile_enrollments me WHERE me.application_id=a.id) AS "enrollmentComplete"
       FROM applications a
      WHERE a.tenant_id=$1
        AND (a.parent_account_id=$2 OR lower(a.parent_email::text)=lower($3))
      ORDER BY a.created_at DESC
      LIMIT 1`,
    [parent.tenantId, parent.id, parent.email],
  );
  const application = result.rows[0];
  const accessState: ParentAccessState = !application
    ? "NO_APPLICATION"
    : application.status === "APPROVED" || application.status === "ENROLLED"
      ? "APPROVED"
      : application.enrollmentComplete
        ? "PENDING_APPROVAL"
        : "APPLICATION_IN_PROGRESS";
  return {
    ...parent,
    applicationStatus: application?.status ?? null,
    applicationReference: application?.reference ?? null,
    accessState,
  };
}
