import { apiHandler } from "@/server/api";
import { getPool, query } from "@/server/db";
import { AppError } from "@/server/errors";
import { getParent } from "@/server/parentAuth";
import { mobileOrderSchema } from "@/server/validation";

export default apiHandler<Record<string, unknown>[]>(
  { methods: ["GET", "POST"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    if (req.method === "GET") {
      const result = await query<Record<string, unknown>>(
        `SELECT o.id,o.reference,o.total_cents AS "totalInCents",o.status,
           o.created_at::text AS "createdAt",b.name AS "branchName",
           COALESCE(json_agg(json_build_object(
             'productId',i.product_id,'name',i.product_name,'quantity',i.quantity,
             'unitPriceInCents',i.unit_price_cents
           ) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
         FROM shop_orders o LEFT JOIN branches b ON b.id=o.branch_id
         LEFT JOIN shop_order_items i ON i.order_id=o.id
         WHERE o.tenant_id=$1 AND o.parent_account_id=$2
         GROUP BY o.id,b.name ORDER BY o.created_at DESC,o.id DESC LIMIT 100`,
        [parent.tenantId, parent.id],
      );
      res.status(200).json({ ok: true, data: result.rows });
      return;
    }
    const input = mobileOrderSchema.parse(req.body);
    const quantities = new Map<string, number>();
    input.items.forEach((item) => quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity));
    const productIds = [...quantities.keys()];
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      if (input.branchId) {
        const branch = await client.query(
          "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 AND status='ACTIVE'",
          [input.branchId, parent.tenantId],
        );
        if (!branch.rows[0]) throw new AppError(422, "BRANCH_NOT_FOUND", "Select a current collection branch.");
      }
      const products = await client.query<{ id: string; name: string; price_cents: number; stock: number }>(
        `SELECT id,name,price_cents,stock FROM shop_products
         WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND status='ACTIVE'
         ORDER BY id FOR UPDATE`,
        [parent.tenantId, productIds],
      );
      if (products.rows.length !== productIds.length) {
        throw new AppError(422, "PRODUCT_NOT_FOUND", "One or more products are no longer available.");
      }
      let total = 0;
      products.rows.forEach((product) => {
        const quantity = quantities.get(product.id)!;
        if (product.stock < quantity) {
          throw new AppError(409, "INSUFFICIENT_STOCK", `${product.name} only has ${product.stock} remaining.`);
        }
        total += product.price_cents * quantity;
      });
      const reference = `ORD-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const order = await client.query<{ id: string }>(
        `INSERT INTO shop_orders
           (tenant_id,parent_account_id,reference,parent_name,branch_id,total_cents)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [parent.tenantId, parent.id, reference, parent.name, input.branchId ?? null, total],
      );
      for (const product of products.rows) {
        const quantity = quantities.get(product.id)!;
        await client.query(
          `INSERT INTO shop_order_items
             (order_id,product_id,product_name,quantity,unit_price_cents)
           VALUES ($1,$2,$3,$4,$5)`,
          [order.rows[0].id, product.id, product.name, quantity, product.price_cents],
        );
        await client.query(
          `UPDATE shop_products SET stock=stock-$3,sold=sold+$3,
             status=CASE WHEN stock-$3=0 THEN 'OUT_OF_STOCK' ELSE status END,updated_at=now()
           WHERE id=$1 AND tenant_id=$2`,
          [product.id, parent.tenantId, quantity],
        );
      }
      await client.query("COMMIT");
      res.status(201).json({
        ok: true,
        data: [{ id: order.rows[0].id, reference, totalInCents: total, status: "PROCESSING" }],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);
