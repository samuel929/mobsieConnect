import { createHash, randomInt } from "crypto";
import { z } from "zod";

import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { sendPasswordResetEmail } from "@/server/mailer";

const schema = z.object({ tenantId: z.uuid(), email: z.email().max(254) });
const hashCode = (value: string) => createHash("sha256").update(value).digest("hex");

export default apiHandler<{ sent: true }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const input = schema.parse(req.body);
    const result = await query<{ id: string; name: string; email: string }>(
      `SELECT id,name,email::text FROM parent_accounts
       WHERE tenant_id=$1 AND lower(email::text)=lower($2) AND deleted_at IS NULL AND is_active=true
       LIMIT 1`,
      [input.tenantId, input.email.trim()],
    );
    const parent = result.rows[0];
    if (parent) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await query(
        `UPDATE parent_password_resets SET used_at=now()
         WHERE parent_account_id=$1 AND used_at IS NULL`,
        [parent.id],
      );
      await query(
        `INSERT INTO parent_password_resets(parent_account_id,code_hash,expires_at)
         VALUES($1,$2,now()+interval '15 minutes')`,
        [parent.id, hashCode(code)],
      );
      try {
        await sendPasswordResetEmail({ to: parent.email, parentName: parent.name, code });
      } catch (error) {
        // Always return the same response to prevent account enumeration.
        console.error("Password reset email delivery failed", error);
      }
    }
    res.status(200).json({ ok: true, data: { sent: true } });
  },
);
