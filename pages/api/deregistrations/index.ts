import { apiHandler, one, pageLimit } from "@/server/api";
import { query } from "@/server/db";

export default apiHandler<Record<string, unknown>[]>(
  { methods: ["GET"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const branchId = one(req.query.branchId);
    const status = one(req.query.status);
    const limit = pageLimit(req.query.limit, 500);
    const result = await query<Record<string, unknown>>(
      `SELECT d.id,d.student_id AS "studentId",d.parent_account_id AS "parentAccountId",
              d.student_name AS "studentName",d.parent_name AS "parentName",
              d.parent_email::text AS "parentEmail",d.branch_id AS "branchId",
              COALESCE(d.branch_name,b.name) AS "branchName",
              d.last_day_of_attendance::text AS "lastDayOfAttendance",
              d.scheduled_for::text AS "removalScheduledFor",d.reason,d.comments,
              d.status,d.parent_removed AS "parentRemoved",
              COALESCE(to_jsonb(d)->>'submitted_at',to_jsonb(d)->>'created_at') AS "submittedAt",
              COALESCE(to_jsonb(d)->>'processed_at',to_jsonb(d)->>'completed_at') AS "processedAt"
         FROM deregistration_requests d
         LEFT JOIN branches b ON b.id=d.branch_id
        WHERE d.tenant_id=$1
          AND ($2::uuid IS NULL OR d.branch_id=$2::uuid)
          AND ($3::text IS NULL OR d.status=$3)
        ORDER BY COALESCE(
          (to_jsonb(d)->>'submitted_at')::timestamptz,
          (to_jsonb(d)->>'created_at')::timestamptz
        ) DESC,d.id DESC
        LIMIT $4`,
      [user!.tenantId, branchId ?? null, status ?? null, limit],
    );
    res.status(200).json({ ok: true, data: result.rows });
  },
);
