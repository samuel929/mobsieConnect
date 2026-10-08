import { apiHandler } from '@/server/api';
import { withTransaction } from '@/server/db';
import { AppError } from '@/server/errors';

type ScheduledRequest = {
  id: string;
  tenantId: string;
  parentAccountId: string | null;
  studentId: string | null;
  branchId: string | null;
  parentEmail: string;
};

type ProcessResult = { processed: number };

export default apiHandler<ProcessResult>(
  { methods: ['POST'], auth: false, rateLimit: false },
  async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid scheduled-task credentials.');
    }

    const processed = await withTransaction(async (client) => {
      const due = await client.query<ScheduledRequest>(
        `SELECT id, tenant_id AS "tenantId", parent_account_id AS "parentAccountId",
                student_id AS "studentId", branch_id AS "branchId", parent_email AS "parentEmail"
         FROM deregistration_requests
         WHERE status = 'SCHEDULED' AND scheduled_for <= CURRENT_DATE
         ORDER BY scheduled_for, submitted_at
         FOR UPDATE SKIP LOCKED`,
      );

      for (const request of due.rows) {
        if (request.studentId) {
          await client.query(
            'DELETE FROM students WHERE id = $1 AND tenant_id = $2',
            [request.studentId, request.tenantId],
          );
          if (request.branchId) {
            await client.query(
              `UPDATE branches
               SET learner_count = GREATEST(learner_count - 1, 0), updated_at = now()
               WHERE id = $1 AND tenant_id = $2`,
              [request.branchId, request.tenantId],
            );
          }
        }

        if (request.parentAccountId) {
          const remaining = await client.query<{ count: string }>(
            `SELECT count(*)::text AS count
             FROM students s
             LEFT JOIN applications a ON a.id = s.application_id
             WHERE s.tenant_id = $1
               AND (
                 s.parent_account_id = $2 OR
                 a.parent_account_id = $2 OR
                 lower(a.parent_email::text) = lower($3)
               )`,
            [request.tenantId, request.parentAccountId, request.parentEmail],
          );

          if (Number(remaining.rows[0]?.count ?? 0) === 0) {
            await client.query(
              `DELETE FROM applications
               WHERE tenant_id = $1
                 AND (parent_account_id = $2 OR lower(parent_email::text) = lower($3))`,
              [request.tenantId, request.parentAccountId, request.parentEmail],
            );
            await client.query(
              'DELETE FROM parent_accounts WHERE id = $1 AND tenant_id = $2',
              [request.parentAccountId, request.tenantId],
            );
          }
        }

        await client.query(
          `UPDATE deregistration_requests
           SET status = 'COMPLETED',
               parent_removed = NOT EXISTS (
                 SELECT 1 FROM parent_accounts
                 WHERE id = $1 AND tenant_id = $2
               ),
               completed_at = now()
           WHERE id = $3`,
          [request.parentAccountId, request.tenantId, request.id],
        );
      }

      return due.rows.length;
    });

    res.status(200).json({ ok: true, data: { processed } });
  },
);
