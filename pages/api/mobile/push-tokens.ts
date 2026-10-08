import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { getParent } from "@/server/parentAuth";

const pushTokenSchema = z.object({
  expoPushToken: z.string().trim().regex(/^(Expo|Exponent)PushToken\[[^\]]+\]$/, "Invalid Expo push token."),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().trim().min(1).max(200).optional(),
});

export default apiHandler<{ registered: true }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    const input = pushTokenSchema.parse(req.body);
    await query(
      `INSERT INTO mobile_push_tokens
         (tenant_id, parent_account_id, expo_push_token, platform, device_id, is_active, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, true, now())
       ON CONFLICT (tenant_id, expo_push_token) DO UPDATE SET
         parent_account_id = EXCLUDED.parent_account_id,
         platform = EXCLUDED.platform,
         device_id = EXCLUDED.device_id,
         is_active = true,
         last_error = NULL,
         last_seen_at = now(),
         updated_at = now()`,
      [parent.tenantId, parent.id, input.expoPushToken, input.platform, input.deviceId ?? null],
    );
    res.status(200).json({ ok: true, data: { registered: true } });
  },
);
