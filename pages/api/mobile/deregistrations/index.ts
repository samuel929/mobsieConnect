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
      // Older enrolments may not have application.parent_account_id populated.
      // Keep ownership checking secure, but recognise the same parent email and
      // normalised phone number fallbacks used by the mobile feed.
      const learner = await client.query<{ id: string; name: string; branchId: string | null; branchName: string | null }>(
        `SELECT s.id, s.name, s.branch_id AS "branchId", b.name AS "branchName"
           FROM students s
           LEFT JOIN applications a ON a.id = s.application_id
           LEFT JOIN branches b ON b.id = s.branch_id
          WHERE s.id = $1
            AND s.tenant_id = $2
            AND (
              a.parent_account_id = $3
              OR lower(trim(s.parent_name)) = lower(trim($4))
              OR lower(trim(COALESCE(a.parent_email, ''))) = lower(trim($5))
              OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g') = regexp_replace($6, '\\D', '', 'g')
            )`,
        [input.studentId, parent.tenantId, parent.id, parent.name, parent.email, parent.phone],
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
