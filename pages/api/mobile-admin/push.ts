import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { createAndSendNotification } from "@/server/expoPush";

const sendPushSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  audience: z.string().trim().min(1).max(160).default("All campuses"),
  scheduledAt: z.iso.datetime().nullable().optional(),
});

export default apiHandler<{ sent: number; failed: number }>(
  { methods: ["POST"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const principal = user!;
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
