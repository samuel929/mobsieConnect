import { apiHandler } from "@/server/api";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { getParent } from "@/server/parentAuth";
import { mobileDeregistrationSchema } from "@/server/validation";

export default apiHandler<{ requestId: string; studentName: string; removalDate: string }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    const input = mobileDeregistrationSchema.parse(req.body);
    const lastDay = new Date(`${input.lastDayOfAttendance}T12:00:00Z`);
    if (Number.isNaN(lastDay.valueOf())) throw new AppError(422, "INVALID_DATE", "Choose a valid final attendance date.");
    const removalDate = `${lastDay.getUTCFullYear()}-12-31`;

    const data = await withTransaction(async (client) => {
      const learner = await client.query<{ id: string; name: string; branchId: string | null; branchName: string | null }>(
        `SELECT s.id, s.name, s.branch_id AS "branchId", b.name AS "branchName"
           FROM students s
           LEFT JOIN applications a ON a.id = s.application_id
           LEFT JOIN branches b ON b.id = s.branch_id
          WHERE s.id = $1
            AND s.tenant_id = $2
            AND (
              s.parent_account_id = $3
              OR
              a.parent_account_id = $3
            )`,
        [input.studentId, parent.tenantId, parent.id],
      );
      if (!learner.rows[0]) throw new AppError(404, "LEARNER_NOT_FOUND", "That learner is not available for this account.");
      await client.query(
        `DELETE FROM deregistration_requests WHERE student_id=$1 AND status='SCHEDULED'`,
        [input.studentId],
      );
      const request = await client.query<{ id: string }>(
        `INSERT INTO deregistration_requests (
           tenant_id, parent_account_id, student_id, branch_id,
           parent_name, parent_email, student_name, branch_name,
           last_day_of_attendance, scheduled_for, removal_scheduled_for,
           reason, comments, notice_accepted, status
         ) VALUES (
           $1,$2,$3,$4,
           $5,$6,$7,$8,
           $9,$10,$11,
           $12,$13,$14,'SCHEDULED'
         ) RETURNING id`,
        [
          parent.tenantId,
          parent.id,
          input.studentId,
          learner.rows[0].branchId,
          parent.name,
          parent.email,
          learner.rows[0].name,
          learner.rows[0].branchName,
          input.lastDayOfAttendance,
          removalDate,
          removalDate,
          input.reason,
          input.comments?.trim() || null,
          input.noticeAccepted,
        ],
      );
      return { requestId: request.rows[0].id, studentName: learner.rows[0].name, removalDate };
    });
    res.status(201).json({ ok: true, data });
  },
);
