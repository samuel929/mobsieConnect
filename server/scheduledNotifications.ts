import { query } from "./db";
import { sendExpoPush } from "./expoPush";

type ScheduledNotification = {
  id: string;
  tenantId: string;
  branchId: string | null;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

/**
 * Atomically claims and sends due notifications. The optional tenant scope lets
 * normal mobile traffic keep scheduled pushes moving on Vercel Hobby, where
 * cron jobs may only run once a day.
 */
export async function processDueScheduledNotifications(tenantId?: string) {
  const due = await query<ScheduledNotification>(
    `UPDATE mobile_notifications SET status='SENDING'
     WHERE id IN (
       SELECT id FROM mobile_notifications
       WHERE status='SCHEDULED' AND scheduled_at<=now()
         AND ($1::uuid IS NULL OR tenant_id=$1)
       ORDER BY scheduled_at LIMIT 100 FOR UPDATE SKIP LOCKED
     )
     RETURNING id,tenant_id AS "tenantId",branch_id AS "branchId",title,body,data`,
    [tenantId ?? null],
  );

  let sent = 0;
  let failed = 0;
  for (const item of due.rows) {
    try {
      const result = await sendExpoPush(item);
      sent += result.sent;
      failed += result.failed;
      await query(
        "UPDATE mobile_notifications SET status=$2,sent_at=now() WHERE id=$1",
        [item.id, result.failed > 0 && result.sent === 0 ? "FAILED" : "SENT"],
      );
    } catch {
      failed += 1;
      await query("UPDATE mobile_notifications SET status='FAILED' WHERE id=$1", [item.id]);
    }
  }
  return { processed: due.rows.length, sent, failed };
}
