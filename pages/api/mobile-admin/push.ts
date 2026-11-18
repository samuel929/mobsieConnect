import { z } from "zod";
import { apiHandler } from "@/server/api";
import { requireDashboardPermission } from "@/server/auth";
import { query } from "@/server/db";
import { createAndSendNotification } from "@/server/expoPush";

const sendPushSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  audience: z.string().trim().min(1).max(160).default("All campuses"),
  scheduledAt: z.iso.datetime().nullable().optional(),
});

export default apiHandler<unknown>(
  { methods: ["GET", "POST"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const principal = user!;
    await requireDashboardPermission(principal, "Communications");

    if (req.method === "GET") {
      const result = await query<{
        id: string;
        title: string;
        body: string;
        audience: string;
        status: string;
        scheduledAt: string | null;
        sentAt: string | null;
        createdAt: string;
        delivered: number;
        opened: number;
        failed: number;
      }>(
        `SELECT n.id,n.title,n.body,n.audience,n.status,
                n.scheduled_at::text AS "scheduledAt",
                n.sent_at::text AS "sentAt",
                n.created_at::text AS "createdAt",
                COALESCE(n.sent_count,0)::int AS delivered,
                COUNT(d.read_at)::int AS opened,
                COALESCE(n.failed_count,0)::int AS failed
           FROM mobile_notifications n
           LEFT JOIN mobile_notification_deliveries d ON d.notification_id=n.id
          WHERE n.tenant_id=$1
            AND ($2::uuid IS NULL OR n.branch_id=$2)
          GROUP BY n.id
          ORDER BY n.created_at DESC
          LIMIT 500`,
        [principal.tenantId, principal.branchId],
      );
      const rows = result.rows;
      res.status(200).json({
        ok: true,
        data: {
          rows,
          stats: {
            notifications: rows.length,
            delivered: rows.reduce((sum, item) => sum + Number(item.delivered || 0), 0),
            opened: rows.reduce((sum, item) => sum + Number(item.opened || 0), 0),
            scheduled: rows.filter((item) => item.status === "SCHEDULED").length,
          },
        },
      });
      return;
    }

    const input = sendPushSchema.parse(req.body);

    const scopedBranch =
      input.audience === "All campuses"
        ? null
        : await query<{ id: string }>(
            "SELECT id FROM branches WHERE tenant_id = $1 AND name = $2 LIMIT 1",
            [principal.tenantId, input.audience],
          );
    const branchId = scopedBranch?.rows[0]?.id ?? null;
    if (input.audience !== "All campuses" && !branchId) {
      throw new Error("The selected branch no longer exists.");
    }

    const delivery=await createAndSendNotification({tenantId:principal.tenantId,branchId,title:input.title,body:input.body,audience:input.audience,scheduledAt:input.scheduledAt,data:{screen:"Notifications"}});
    res.status(200).json({ ok: true, data: delivery });
  },
);
