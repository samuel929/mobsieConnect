import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payment = Array.isArray(req.query.payment) ? req.query.payment[0] : req.query.payment;
  const shopPayment = Array.isArray(req.query.shopPayment)
    ? req.query.shopPayment[0]
    : req.query.shopPayment;
  let returnUrl: string | null = null;
  if (shopPayment) {
    const existing = await query<{ returnUrl: string | null }>(
      `SELECT return_url AS "returnUrl" FROM shop_order_payments WHERE id=$1`, [shopPayment],
    );
    returnUrl = existing.rows[0]?.returnUrl ?? null;
    await query(
      `WITH cancelled AS (
         UPDATE shop_order_payments SET status='CANCELLED',updated_at=now()
         WHERE id=$1 AND status<>'COMPLETE' RETURNING order_id
       ), cancelled_order AS (
         UPDATE shop_orders SET status='CANCELLED',updated_at=now()
         WHERE id IN (SELECT order_id FROM cancelled) AND status='AWAITING_PAYMENT' RETURNING id
       ), quantities AS (
         SELECT i.product_id,sum(i.quantity)::integer AS quantity
         FROM shop_order_items i WHERE i.order_id IN (SELECT id FROM cancelled_order)
         GROUP BY i.product_id
       )
       UPDATE shop_products p SET stock=p.stock+q.quantity,
         sold=GREATEST(0,p.sold-q.quantity),
         status=CASE WHEN p.status='OUT_OF_STOCK' THEN 'ACTIVE' ELSE p.status END,
         updated_at=now()
       FROM quantities q WHERE p.id=q.product_id`,
      [shopPayment],
    );
  } else if (payment) {
    const updated = await query<{ returnUrl: string | null }>(
      `UPDATE application_payments SET status='CANCELLED',updated_at=now()
       WHERE id=$1 AND status<>'COMPLETE' RETURNING return_url AS "returnUrl"`, [payment],
    );
    returnUrl = updated.rows[0]?.returnUrl ?? null;
  }
  const fallback = shopPayment ? "mobsieconnect://shop/payment/cancel" : "mobsieconnect://payment/cancel";
  const base = (returnUrl || fallback).replace(/payment\/return(?:\/)?$/, "payment/cancel");
  const separator = base.includes("?") ? "&" : "?";
  const key = shopPayment ? "shopPayment" : "payment";
  const target = `${base}${separator}${key}=${encodeURIComponent(shopPayment || payment || "")}`;
  const encoded = JSON.stringify(target).replace(/</g, "\\u003c");
  const escaped = target.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Payment cancelled</title></head><body style="margin:0;background:#f8f4ec;color:#173f36;font-family:Arial,sans-serif"><main style="max-width:520px;margin:48px auto;padding:32px;text-align:center"><h1>Payment cancelled</h1><p>No payment was recorded. Return to Mobsie Connect when you are ready.</p><a href="${escaped}" style="display:inline-block;margin-top:18px;padding:15px 24px;border-radius:14px;background:#008d85;color:#fff;text-decoration:none;font-weight:700">Return to Mobsie Connect</a></main><script>setTimeout(function(){window.location.href=${encoded}},250)</script></body></html>`);
}
