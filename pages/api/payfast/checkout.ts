import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/server/db";
import { payFastConfig, payFastForm, payFastSignature, type PayFastFields } from "@/server/payfast";

type CheckoutPayment = {
  id: string; merchantPaymentId: string; amountCents: number; status: string;
  reference: string; parentName: string; parentEmail: string; parentPhone: string;
  itemName: string; itemDescription: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  const applicationPayment = Array.isArray(req.query.payment) ? req.query.payment[0] : req.query.payment;
  const shopPayment = Array.isArray(req.query.shopPayment) ? req.query.shopPayment[0] : req.query.shopPayment;
  let row: CheckoutPayment | undefined;
  let returnPath = "";
  let cancelPath = "";
  let notifyPath = "";

  if (shopPayment) {
    const result = await query<CheckoutPayment>(
      `SELECT p.id,p.merchant_payment_id AS "merchantPaymentId",p.amount_cents AS "amountCents",p.status,
              o.reference,o.parent_name AS "parentName",a.email::text AS "parentEmail",a.phone AS "parentPhone",
              'Mobsie shop order ' || o.reference AS "itemName",
              'School shop collection order' AS "itemDescription"
       FROM shop_order_payments p JOIN shop_orders o ON o.id=p.order_id
       JOIN parent_accounts a ON a.id=o.parent_account_id WHERE p.id=$1`,
      [shopPayment],
    );
    row = result.rows[0];
    returnPath = `/api/payfast/return/?shopPayment=${shopPayment}`;
    cancelPath = `/api/payfast/cancel/?shopPayment=${shopPayment}`;
    notifyPath = "/api/payfast/notify/?type=shop";
  } else if (applicationPayment) {
    const result = await query<CheckoutPayment>(
      `SELECT x.id,x.merchant_payment_id AS "merchantPaymentId",x.amount_cents AS "amountCents",x.status,
              a.reference,a.parent_name AS "parentName",a.parent_email AS "parentEmail",a.parent_phone AS "parentPhone",
              'Mobsie application ' || a.reference AS "itemName",
              'Application fee for ' || a.child_name AS "itemDescription"
       FROM application_payments x JOIN applications a ON a.id=x.application_id WHERE x.id=$1`,
      [applicationPayment],
    );
    row = result.rows[0];
    returnPath = `/api/payfast/return/?payment=${applicationPayment}`;
    cancelPath = `/api/payfast/cancel/?payment=${applicationPayment}`;
    notifyPath = "/api/payfast/notify/";
  }
  if (!row || !["CREATED", "PENDING"].includes(row.status)) {
    res.status(404).send("Payment session is unavailable."); return;
  }
  const config = payFastConfig();
  const names = String(row.parentName).trim().split(/\s+/);
  const fields: PayFastFields = {
    merchant_id: config.merchantId, merchant_key: config.merchantKey,
    return_url: `${config.appUrl}${returnPath}`, cancel_url: `${config.appUrl}${cancelPath}`,
    notify_url: `${config.appUrl}${notifyPath}`, name_first: names[0] || "Parent",
    name_last: names.slice(1).join(" ") || "Guardian", email_address: row.parentEmail,
    cell_number: row.parentPhone || "", m_payment_id: row.merchantPaymentId,
    amount: (Number(row.amountCents) / 100).toFixed(2), item_name: row.itemName,
    item_description: row.itemDescription,
  };
  fields.signature = payFastSignature(fields, config.passphrase);
  const table = shopPayment ? "shop_order_payments" : "application_payments";
  await query(`UPDATE ${table} SET status='PENDING',updated_at=now() WHERE id=$1`, [row.id]);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(payFastForm(fields, config.processUrl));
}
