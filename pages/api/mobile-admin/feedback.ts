import { z } from "zod";
import { apiHandler, pageLimit } from "@/server/api";
import { query } from "@/server/db";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["NEW", "OPEN", "READ", "RESOLVED"]),
});

export default apiHandler<Record<string, unknown>[]>(
  { methods: ["GET", "PUT"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    if (req.method === "PUT") {
      const input = updateSchema.parse(req.body);
      const result = await query<Record<string, unknown>>(
        `UPDATE parent_feedback SET status=$1
         WHERE id=$2 AND tenant_id=$3
         RETURNING id,status`,
        [input.status, input.id, user!.tenantId],
      );
      if (!result.rows[0]) {
        res.status(404).json({
          ok: false,
          error: { code: "FEEDBACK_NOT_FOUND", message: "The feedback no longer exists." },
        });
        return;
      }
      res.status(200).json({ ok: true, data: result.rows });
      return;
    }

    const result = await query<Record<string, unknown>>(
      `SELECT f.id,p.name AS "parentName",b.name AS "branchName",f.category,f.message,f.rating,f.status,
         f.created_at::text AS "createdAt"
       FROM parent_feedback f
       JOIN parent_accounts p ON p.id=f.parent_account_id
       LEFT JOIN branches b ON b.id=p.preferred_branch_id
       WHERE f.tenant_id=$1
       ORDER BY f.created_at DESC,f.id DESC LIMIT $2`,
      [user!.tenantId, pageLimit(req.query.limit, 500)],
    );
    res.status(200).json({ ok: true, data: result.rows });
  },
);
