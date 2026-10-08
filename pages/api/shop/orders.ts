import { apiHandler, one, pageLimit, pageNumber } from "@/server/api";
import { query } from "@/server/db";
import { shopOrderStatusSchema } from "@/server/validation";

type OrderRow = {
  id: string; reference: string; parentName: string; branchName: string | null;
  items: string; total: number; status: string; createdAt: string; totalCount?: string;
};

export default apiHandler<OrderRow[]>(
  { methods: ["GET", "PUT"], roles: ["PRINCIPAL"] },
  async (req, res, context) => {
    const tenantId = context.user!.tenantId;
    if (req.method === "PUT") {
      const input = shopOrderStatusSchema.parse(req.body);
      const result = await query<OrderRow>(
        `UPDATE shop_orders SET status=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2
         RETURNING id,reference,parent_name AS "parentName",NULL::text AS "branchName",
           ''::text AS items,total_cents/100.0 AS total,status,created_at::text AS "createdAt"`,
        [input.id, tenantId, input.status],
      );
      res.status(200).json({ ok: true, data: result.rows });
      return;
    }
    const page = pageNumber(req.query.page);
    const limit = pageLimit(req.query.limit, 100);
    const search = (one(req.query.search) ?? "").trim();
    const result = await query<OrderRow>(
      `SELECT o.id,o.reference,o.parent_name AS "parentName",b.name AS "branchName",
         COALESCE(string_agg(i.quantity || ' × ' || i.product_name, ', ' ORDER BY i.id),'') AS items,
         o.total_cents/100.0 AS total,o.status,o.created_at::text AS "createdAt",
         count(*) OVER()::text AS "totalCount"
       FROM shop_orders o LEFT JOIN branches b ON b.id=o.branch_id
       LEFT JOIN shop_order_items i ON i.order_id=o.id
       WHERE o.tenant_id=$1 AND ($2='' OR o.reference ILIKE $2 OR o.parent_name ILIKE $2)
       GROUP BY o.id,b.name ORDER BY o.created_at DESC,o.id DESC LIMIT $3 OFFSET $4`,
      [tenantId, search ? `%${search}%` : "", limit, (page - 1) * limit],
    );
    const total = Number(result.rows[0]?.totalCount ?? 0);
    res.status(200).json({ ok: true, data: result.rows, meta: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) } });
  },
);
