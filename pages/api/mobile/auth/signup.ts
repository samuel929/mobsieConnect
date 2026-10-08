import bcrypt from "bcryptjs";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { createParentToken, type ParentSession } from "@/server/parentAuth";
import { linkExistingApplicationsToParent } from "@/server/parentApplicationLink";
import { parentSignupSchema } from "@/server/validation";
import { withParentApplicationState, type ParentUser } from "@/server/parentApplicationState";

export default apiHandler<{ token: string; user: ParentUser }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const input = parentSignupSchema.parse(req.body);
    const tenant = await query<{ id: string }>("SELECT id FROM tenants WHERE id = $1", [
      input.tenantId,
    ]);
    if (!tenant.rowCount) throw new AppError(404, "SCHOOL_NOT_FOUND", "School not found.");
    const existing = await query("SELECT 1 FROM parent_accounts WHERE tenant_id = $1 AND email = $2", [
      input.tenantId,
      input.email,
    ]);
    if (existing.rowCount) {
      throw new AppError(409, "EMAIL_EXISTS", "An account already exists for this email.");
    }
    const result = await query<ParentSession>(
      `INSERT INTO parent_accounts (tenant_id, email, name, phone, password_hash)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, tenant_id AS "tenantId", email::text, name, phone`,
      [input.tenantId, input.email, input.name, input.phone, await bcrypt.hash(input.password, 12)],
    );
    const user = result.rows[0];
    await linkExistingApplicationsToParent(user);
    res.status(201).json({ ok: true, data: { token: await createParentToken(user), user: await withParentApplicationState(user) } });
  },
);
