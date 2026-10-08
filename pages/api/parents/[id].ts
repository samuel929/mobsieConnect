import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { adminParentSchema } from "@/server/validation";

type ParentRow = Record<string, unknown>;

function parentId(value: string | string[] | undefined) {
  const id = one(value);
  if (!id) throw new AppError(400, "INVALID_PARENT_ID", "A parent id is required.");
  return id;
}

export default apiHandler<ParentRow[]>(
  { methods: ["PUT", "DELETE"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const id = parentId(req.query.id);

    if (req.method === "DELETE") {
      const result = await query<ParentRow>(
        `UPDATE parent_accounts
         SET is_active=false, updated_at=now()
         WHERE id=$1 AND tenant_id=$2
         RETURNING id`,
        [id, user!.tenantId],
      );
      if (!result.rows[0]) throw new AppError(404, "PARENT_NOT_FOUND", "Parent not found.");
      res.status(200).json({ ok: true, data: result.rows });
      return;
    }

    const input = adminParentSchema.parse(req.body);
    const branch = await query<{ id: string }>(
      "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 AND status <> 'INACTIVE'",
      [input.branchId, user!.tenantId],
    );
    if (!branch.rows[0]) throw new AppError(422, "INVALID_BRANCH", "Select an active campus.");

    const result = await query<ParentRow>(
      `UPDATE parent_accounts
       SET name=$3,email=$4,phone=$5,preferred_branch_id=$6,updated_at=now()
       WHERE id=$1 AND tenant_id=$2
       RETURNING id,email::text,name,phone,preferred_branch_id AS "branchId",
         is_active AS "isActive",created_at::text AS "createdAt"`,
      [id, user!.tenantId, input.name, input.email, input.phone, input.branchId],
    );
    if (!result.rows[0]) throw new AppError(404, "PARENT_NOT_FOUND", "Parent not found.");
    res.status(200).json({ ok: true, data: result.rows });
  },
);
