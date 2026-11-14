import { z } from "zod";

import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";

const schema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).optional() });

type ProductStats = {
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
};

type SalesStats = {
  revenueCents: number;
  paidOrders: number;
  averageOrderCents: number;
};

type OrderStats = {
  awaitingCollection: number;
  collectedOrders: number;
};

type BestSeller = {
  name: string;
  quantity: number;
};

export default apiHandler<unknown>(
  { methods: ["GET"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const input = schema.parse({ period: one(req.query.period) });
    const period = input.period ?? new Date().toISOString().slice(0, 7);
    const params = [user!.tenantId, `${period}-01`];

    const [products, sales, orders, bestseller] = await Promise.all([
      query<ProductStats>(
        `SELECT
           COUNT(*) FILTER (WHERE status<>'HIDDEN')::int AS "activeProducts",
           COUNT(*) FILTER (WHERE status<>'HIDDEN' AND stock>0 AND stock<20)::int AS "lowStock",
           COUNT(*) FILTER (WHERE status<>'HIDDEN' AND stock=0)::int AS "outOfStock"
         FROM shop_products
         WHERE tenant_id=$1 AND deleted_at IS NULL`,
        [user!.tenantId],
      ),
      query<SalesStats>(
        `WITH bounds AS (
           SELECT $2::date AS starts_at, ($2::date + interval '1 month') AS ends_at
         ), paid_orders AS (
           SELECT payment.order_id,
             MAX(COALESCE(payment.amount_gross_cents,payment.amount_cents))::bigint AS paid_cents
           FROM shop_order_payments payment
           JOIN shop_orders shop_order ON shop_order.id=payment.order_id AND shop_order.tenant_id=$1
           CROSS JOIN bounds
           WHERE payment.status='COMPLETE'
             AND payment.paid_at>=bounds.starts_at AND payment.paid_at<bounds.ends_at
           GROUP BY payment.order_id
         )
         SELECT COALESCE(SUM(paid_cents),0)::float8 AS "revenueCents",
           COUNT(*)::int AS "paidOrders",
           COALESCE(AVG(paid_cents),0)::float8 AS "averageOrderCents"
         FROM paid_orders`,
        params,
      ),
      query<OrderStats>(
        `SELECT
           COUNT(*) FILTER (WHERE status='READY_FOR_COLLECTION')::int AS "awaitingCollection",
           COUNT(*) FILTER (WHERE status='COLLECTED')::int AS "collectedOrders"
         FROM shop_orders WHERE tenant_id=$1`,
        [user!.tenantId],
      ),
      query<BestSeller>(
        `WITH bounds AS (
           SELECT $2::date AS starts_at, ($2::date + interval '1 month') AS ends_at
         ), paid_orders AS (
           SELECT DISTINCT payment.order_id
           FROM shop_order_payments payment
           JOIN shop_orders shop_order ON shop_order.id=payment.order_id AND shop_order.tenant_id=$1
           CROSS JOIN bounds
           WHERE payment.status='COMPLETE'
             AND payment.paid_at>=bounds.starts_at AND payment.paid_at<bounds.ends_at
         )
         SELECT item.product_name AS name, SUM(item.quantity)::int AS quantity
         FROM paid_orders paid
         JOIN shop_order_items item ON item.order_id=paid.order_id
         GROUP BY item.product_name
         ORDER BY SUM(item.quantity) DESC, item.product_name
         LIMIT 1`,
        params,
      ),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        period,
        ...(products.rows[0] ?? { activeProducts: 0, lowStock: 0, outOfStock: 0 }),
        ...(sales.rows[0] ?? { revenueCents: 0, paidOrders: 0, averageOrderCents: 0 }),
        ...(orders.rows[0] ?? { awaitingCollection: 0, collectedOrders: 0 }),
        bestSeller: bestseller.rows[0] ?? null,
      },
    });
  },
);
