import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { adminParentSchema } from "@/server/validation";

type ParentRow = Record<string, unknown>;

export default apiHandler<ParentRow[]>(
  { methods: ["GET", "POST"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    if (req.method === "POST") {
      const input = adminParentSchema.parse(req.body);
      const branch = await query<{ id: string }>(
        "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 AND status <> 'INACTIVE'",
        [input.branchId, user!.tenantId],
      );
      if (!branch.rows[0]) throw new AppError(422, "INVALID_BRANCH", "Select an active campus.");
      const result = await query<ParentRow>(
        `INSERT INTO parent_accounts
           (tenant_id,email,name,phone,password_hash,preferred_branch_id,invited_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (tenant_id,email) DO UPDATE SET
           name=EXCLUDED.name,phone=EXCLUDED.phone,
           preferred_branch_id=EXCLUDED.preferred_branch_id,is_active=true,updated_at=now()
         RETURNING id,email::text,name,phone,preferred_branch_id AS "branchId",
           is_active AS "isActive",created_at::text AS "createdAt"`,
        [
          user!.tenantId, input.email, input.name, input.phone,
          await bcrypt.hash(randomUUID(), 12), input.branchId,
        ],
      );
      res.status(201).json({ ok: true, data: result.rows });
      return;
    }

    const search = (one(req.query.search) ?? "").trim();
    const result = await query<ParentRow>(
      `SELECT p.id,p.email::text,p.name,p.phone,p.preferred_branch_id AS "branchId",
         b.name AS "branchName",p.is_active AS "isActive",
         (SELECT count(*)::int FROM students s WHERE s.parent_account_id=p.id) AS children,
         (SELECT count(*)::int FROM applications a WHERE a.parent_account_id=p.id) AS applications,
         p.last_login_at::text AS "lastLoginAt",p.created_at::text AS "createdAt"
       FROM parent_accounts p
       LEFT JOIN branches b ON b.id=p.preferred_branch_id
       WHERE p.tenant_id=$1
         AND ($2='' OR p.name ILIKE '%'||$2||'%' OR p.email::text ILIKE '%'||$2||'%')
       ORDER BY p.created_at DESC,p.id DESC`,
      [user!.tenantId, search],
    );
    res.status(200).json({ ok: true, data: result.rows });
  },
);
