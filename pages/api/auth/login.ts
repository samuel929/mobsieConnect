import bcrypt from "bcryptjs";
import { apiHandler } from "@/server/api";
import { createSessionToken, sessionCookie } from "@/server/auth";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { loginSchema } from "@/server/validation";
import type { SessionUser } from "@/types/domain";

type UserRow = SessionUser & { passwordHash: string; isActive: boolean };

export default apiHandler<{ user: SessionUser }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await query<UserRow>(
      `SELECT id, tenant_id AS "tenantId", branch_id AS "branchId", email::text,
              name, role, password_hash AS "passwordHash", is_active AS "isActive"
       FROM users WHERE email = $1 LIMIT 1`,
      [input.email],
    );
    const user = result.rows[0];
    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    const sessionUser: SessionUser = {
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    res.setHeader("Set-Cookie", sessionCookie(await createSessionToken(sessionUser)));
    res.status(200).json({ ok: true, data: { user: sessionUser } });
  },
);
