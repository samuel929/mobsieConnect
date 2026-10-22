import { z } from "zod";

import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { getParent } from "@/server/parentAuth";

const readSchema = z.object({ id: z.string().uuid() });

export default apiHandler<{ id: string; readAt: string }>(
  { methods: ["PATCH"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    const input = readSchema.parse(req.body);
    const result = await query<{ id: string; readAt: string }>(
      `UPDATE mobile_notification_deliveries
       SET read_at=COALESCE(read_at,now())
       WHERE notification_id=$1 AND parent_account_id=$2
       RETURNING notification_id AS id,read_at::text AS "readAt"`,
      [input.id, parent.id],
    );
    if (!result.rows[0]) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "The notification is no longer available.");
    }
    res.status(200).json({ ok: true, data: result.rows[0] });
  },
);

