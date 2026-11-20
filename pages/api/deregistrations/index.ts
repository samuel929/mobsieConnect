import { apiHandler, one, pageLimit } from "@/server/api";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { z } from "zod";

const createSchema = z.object({
  applicationId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  lastDayOfAttendance: z.string().date(),
  reason: z.enum(["MOVING_SCHOOLS", "RELOCATING", "FINANCIAL_REASONS", "PERSONAL_REASONS", "OTHER"]),
  comments: z.string().trim().max(1000).optional().default(""),
}).refine((value) => Boolean(value.applicationId || value.studentId), {
  message: "Choose a learner to deregister.",
});

export default apiHandler<unknown>(
  { methods: ["GET", "POST"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    if (req.method === "POST") {
      const input = createSchema.parse(req.body);
      const lastDay = new Date(`${input.lastDayOfAttendance}T12:00:00Z`);
      if (Number.isNaN(lastDay.valueOf())) throw new AppError(422, "INVALID_DATE", "Choose a valid final attendance date.");
      const removalDate = `${lastDay.getUTCFullYear()}-12-31`;
      const created = await withTransaction(async (client) => {
        const learner = await client.query<{
          id: string; name: string; branchId: string; branchName: string;
          parentAccountId: string | null; parentName: string; parentEmail: string;
        }>(
          `SELECT s.id,s.name,s.branch_id AS "branchId",b.name AS "branchName",
                  COALESCE(s.parent_account_id,a.parent_account_id) AS "parentAccountId",
                  COALESCE(a.parent_name,s.parent_name) AS "parentName",
                  COALESCE(a.parent_email::text,p.email::text) AS "parentEmail"
             FROM students s
             LEFT JOIN applications a ON a.id=s.application_id
             LEFT JOIN parent_accounts p ON p.id=COALESCE(s.parent_account_id,a.parent_account_id)
             JOIN branches b ON b.id=s.branch_id
            WHERE ($1::uuid IS NULL OR s.application_id=$1::uuid)
              AND ($2::uuid IS NULL OR s.id=$2::uuid)
              AND s.tenant_id=$3
            LIMIT 1`,
          [input.applicationId ?? null, input.studentId ?? null, user!.tenantId],
        );
        if (!learner.rows[0]) throw new AppError(404, "LEARNER_NOT_FOUND", "The approved learner record could not be found.");
        await client.query("DELETE FROM deregistration_requests WHERE student_id=$1 AND status='SCHEDULED'", [learner.rows[0].id]);
        const result = await client.query<{ id: string }>(
          `INSERT INTO deregistration_requests (
             tenant_id,parent_account_id,student_id,branch_id,parent_name,parent_email,
             student_name,branch_name,last_day_of_attendance,scheduled_for,removal_scheduled_for,
             reason,comments,notice_accepted,status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,true,'SCHEDULED')
           RETURNING id`,
          [user!.tenantId, learner.rows[0].parentAccountId, learner.rows[0].id,
           learner.rows[0].branchId, learner.rows[0].parentName, learner.rows[0].parentEmail,
           learner.rows[0].name, learner.rows[0].branchName, input.lastDayOfAttendance,
           removalDate, input.reason, input.comments || null],
        );
        return { id: result.rows[0].id, removalDate };
      });
      res.status(201).json({ ok: true, data: created });
      return;
    }
    const branchId = one(req.query.branchId);
    const status = one(req.query.status);
    const limit = pageLimit(req.query.limit, 500);
    const result = await query<Record<string, unknown>>(
      `SELECT d.id,d.student_id AS "studentId",d.parent_account_id AS "parentAccountId",
              d.student_name AS "studentName",d.parent_name AS "parentName",
              d.parent_email::text AS "parentEmail",p.phone AS "parentPhone",d.branch_id AS "branchId",
              COALESCE(d.branch_name,b.name) AS "branchName",
              d.last_day_of_attendance::text AS "lastDayOfAttendance",
              d.scheduled_for::text AS "removalScheduledFor",d.reason,d.comments,
              d.status,d.parent_removed AS "parentRemoved",
              s.application_id AS "applicationId",a.reference AS "applicationReference",
              s.date_of_birth::text AS "dateOfBirth",s.grade,
              s.class_name AS "className",s.enrollment_status AS "enrollmentStatus",
              a.child_gender AS "gender",a.application_type::text AS "applicationType",
              a.current_grade AS "applicationGrade",a.submitted_at::text AS "applicationSubmittedAt",
              COALESCE(to_jsonb(d)->>'submitted_at',to_jsonb(d)->>'created_at') AS "submittedAt",
              COALESCE(to_jsonb(d)->>'processed_at',to_jsonb(d)->>'completed_at') AS "processedAt"
         FROM deregistration_requests d
         LEFT JOIN branches b ON b.id=d.branch_id
         LEFT JOIN students s ON s.id=d.student_id
         LEFT JOIN applications a ON a.id=s.application_id
         LEFT JOIN parent_accounts p ON p.id=COALESCE(d.parent_account_id,s.parent_account_id,a.parent_account_id)
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
