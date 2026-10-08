import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must contain at least 8 characters.").max(128),
  role: z.enum(["PRINCIPAL", "TEACHER"]),
  branchId: z.uuid().nullable().optional(),
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "PRINCIPAL" | "TEACHER";
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export default apiHandler<UserRow[]>({ methods: ["GET", "POST"], roles: ["PRINCIPAL"] }, async (req, res, { user }) => {
  if (req.method === "GET") {
    const result = await query<UserRow>(
      `SELECT u.id,u.name,u.email::text,u.role,u.branch_id AS "branchId",b.name AS "branchName",
        u.is_active AS "isActive",u.last_login_at::text AS "lastLoginAt",u.created_at::text AS "createdAt"
       FROM users u LEFT JOIN branches b ON b.id=u.branch_id
       WHERE u.tenant_id=$1 ORDER BY u.created_at DESC`,
      [user!.tenantId],
    );
    res.status(200).json({ ok: true, data: result.rows });
    return;
  }

  const input = createUserSchema.parse(req.body);
  if (input.branchId) {
    const branch = await query("SELECT 1 FROM branches WHERE id=$1 AND tenant_id=$2", [input.branchId, user!.tenantId]);
    if (!branch.rows[0]) throw new AppError(422, "BRANCH_NOT_FOUND", "Select a valid campus.");
  }
  const duplicate = await query("SELECT 1 FROM users WHERE tenant_id=$1 AND email=$2", [user!.tenantId, input.email]);
  if (duplicate.rows[0]) throw new AppError(409, "EMAIL_IN_USE", "A user with this email already exists.");

  const result = await query<UserRow>(
    `WITH inserted AS (
       INSERT INTO users (tenant_id,branch_id,email,name,password_hash,role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *
     )
     SELECT i.id,i.name,i.email::text,i.role,i.branch_id AS "branchId",b.name AS "branchName",
       i.is_active AS "isActive",i.last_login_at::text AS "lastLoginAt",i.created_at::text AS "createdAt"
     FROM inserted i LEFT JOIN branches b ON b.id=i.branch_id`,
    [user!.tenantId, input.branchId ?? null, input.email, input.name, await bcrypt.hash(input.password, 12), input.role],
  );
  res.status(201).json({ ok: true, data: result.rows });
});
