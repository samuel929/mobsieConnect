import bcrypt from "bcryptjs";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { createParentToken, type ParentSession } from "@/server/parentAuth";
import { linkExistingApplicationsToParent } from "@/server/parentApplicationLink";
import { parentLoginSchema } from "@/server/validation";
import { withParentApplicationState, type ParentUser } from "@/server/parentApplicationState";

type ParentRow = ParentSession & { passwordHash: string; isActive: boolean };

export default apiHandler<{ token: string; user: ParentUser }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const input = parentLoginSchema.parse(req.body);
    const result = await query<ParentRow>(
      `SELECT id, tenant_id AS "tenantId", email::text, name, phone,
         password_hash AS "passwordHash", is_active AS "isActive"
       FROM parent_accounts
       WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [input.tenantId, input.email],
    );
    const parent = result.rows[0];
    if (!parent || !parent.isActive || !(await bcrypt.compare(input.password, parent.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    await query("UPDATE parent_accounts SET last_login_at = now() WHERE id = $1", [parent.id]);
    const user: ParentSession = {
      id: parent.id,
      tenantId: parent.tenantId,
      email: parent.email,
      name: parent.name,
      phone: parent.phone,
    };
    await linkExistingApplicationsToParent(user);
    res.status(200).json({ ok: true, data: { token: await createParentToken(user), user: await withParentApplicationState(user) } });
  },
);
