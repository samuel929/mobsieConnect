import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { z } from "zod";

import { apiHandler } from "@/server/api";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";

const schema = z.object({
  tenantId: z.uuid(),
  email: z.email().max(254),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(128),
});
const hashCode = (value: string) => createHash("sha256").update(value).digest("hex");

export default apiHandler<{ reset: true }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const input = schema.parse(req.body);
    await withTransaction(async (client) => {
      const result = await client.query<{ resetId: string; parentId: string }>(
        `SELECT r.id AS "resetId",p.id AS "parentId"
           FROM parent_accounts p
           JOIN parent_password_resets r ON r.parent_account_id=p.id
          WHERE p.tenant_id=$1 AND lower(p.email::text)=lower($2)
            AND r.code_hash=$3 AND r.used_at IS NULL AND r.expires_at>now()
          ORDER BY r.created_at DESC LIMIT 1 FOR UPDATE OF r`,
        [input.tenantId, input.email.trim(), hashCode(input.code)],
      );
      const match = result.rows[0];
      if (!match) throw new AppError(422, "INVALID_RESET_CODE", "The reset code is incorrect or has expired.");
      await client.query("UPDATE parent_accounts SET password_hash=$1,updated_at=now() WHERE id=$2", [await bcrypt.hash(input.password, 12), match.parentId]);
      await client.query("UPDATE parent_password_resets SET used_at=now() WHERE parent_account_id=$1 AND used_at IS NULL", [match.parentId]);
    });
    res.status(200).json({ ok: true, data: { reset: true } });
  },
);
