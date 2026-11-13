import { apiHandler, pageLimit } from "@/server/api";
import { query } from "@/server/db";

const METHOD_LABELS: Record<string,string> = {
  cc: "Credit card",
  dc: "Debit card",
  eft: "Instant EFT",
  mp: "Masterpass",
  sc: "SCode",
  ss: "SnapScan",
  zp: "Zapper",
  mc: "Mobicred",
  ap: "Apple Pay",
  cp: "Capitec Pay",
  payfast: "PayFast",
};

function methodLabel(value:unknown){
  const code=String(value||"").trim().toLowerCase();
  return METHOD_LABELS[code]||String(value||"PayFast");
}

export default apiHandler<unknown>(
  { methods:["GET"], roles:["PRINCIPAL"] },
  async(req,res,context)=>{
    const result=await query<Record<string,unknown>>(
      `WITH payment_feed AS (
         SELECT
           payment.id,
           payment.merchant_payment_id AS "merchantPaymentId",
           payment.pf_payment_id AS "payFastPaymentId",
           payment.status,
           COALESCE(payment.amount_gross_cents, payment.amount_cents) AS "grossCents",
           COALESCE(payment.amount_fee_cents, 0) AS "feeCents",
           COALESCE(payment.amount_net_cents, payment.amount_gross_cents, payment.amount_cents) AS "netCents",
           COALESCE(payment.payment_method, NULLIF(payment.payment_payload->>'payment_method',''), 'payfast') AS "methodCode",
           COALESCE(NULLIF(concat_ws(' ',payment.payer_first_name,payment.payer_last_name),''), application.parent_name) AS "payerName",
           COALESCE(payment.payer_email, NULLIF(payment.payment_payload->>'email_address',''), application.parent_email::text) AS "payerEmail",
           application.reference AS "paymentReference",
           application.child_name AS "childName",
           branch.id AS "branchId",
           branch.name AS "branchName",
           'APPLICATION_FEE'::text AS "paymentType",
           COALESCE(
             NULLIF(payment.payment_payload->>'item_description',''),
             'Registration fee for ' || application.child_name
           ) AS description,
           payment.paid_at AS "paidAtValue",
           payment.created_at AS "createdAtValue"
         FROM application_payments payment
         JOIN applications application ON application.id=payment.application_id
         LEFT JOIN application_preferences preference ON preference.application_id=application.id
         LEFT JOIN branches branch ON branch.id=preference.branch_id
         WHERE application.tenant_id=$1

         UNION ALL

         SELECT
           payment.id,
           payment.merchant_payment_id AS "merchantPaymentId",
           payment.pf_payment_id AS "payFastPaymentId",
           payment.status,
           COALESCE(payment.amount_gross_cents, payment.amount_cents) AS "grossCents",
           COALESCE(payment.amount_fee_cents, 0) AS "feeCents",
           COALESCE(payment.amount_net_cents, payment.amount_gross_cents, payment.amount_cents) AS "netCents",
           COALESCE(payment.payment_method, NULLIF(payment.payment_payload->>'payment_method',''), 'payfast') AS "methodCode",
           COALESCE(NULLIF(concat_ws(' ',payment.payer_first_name,payment.payer_last_name),''), shop_order.parent_name) AS "payerName",
           COALESCE(payment.payer_email, NULLIF(payment.payment_payload->>'email_address',''), parent.email::text) AS "payerEmail",
           shop_order.reference AS "paymentReference",
           NULL::text AS "childName",
           branch.id AS "branchId",
           branch.name AS "branchName",
           'SHOP_PAYMENT'::text AS "paymentType",
           'Shop payment — ' || COALESCE(items.names, shop_order.reference) AS description,
           payment.paid_at AS "paidAtValue",
           payment.created_at AS "createdAtValue"
         FROM shop_order_payments payment
         JOIN shop_orders shop_order ON shop_order.id=payment.order_id
         LEFT JOIN parent_accounts parent ON parent.id=shop_order.parent_account_id
         LEFT JOIN branches branch ON branch.id=shop_order.branch_id
         LEFT JOIN LATERAL (
           SELECT string_agg(item.quantity::text || ' × ' || item.product_name, ', ' ORDER BY item.id) AS names
           FROM shop_order_items item
           WHERE item.order_id=shop_order.id
         ) items ON true
         WHERE shop_order.tenant_id=$1
       )
       SELECT *,
         "paymentReference" AS "applicationReference",
         "paidAtValue"::text AS "paidAt",
         "createdAtValue"::text AS "createdAt"
       FROM payment_feed
       ORDER BY COALESCE("paidAtValue","createdAtValue") DESC, id DESC
       LIMIT $2`,
      [context.user!.tenantId,pageLimit(req.query.limit,1000)],
    );
    const payments=result.rows.map((row)=>({
      ...row,
      method:methodLabel(row.methodCode),
    }));
    res.status(200).json({ok:true,data:payments});
  },
);
