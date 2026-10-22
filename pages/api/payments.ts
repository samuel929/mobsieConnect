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
      `SELECT
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
         application.reference AS "applicationReference",
         application.child_name AS "childName",
         branch.id AS "branchId",
         branch.name AS "branchName",
         payment.paid_at::text AS "paidAt",
         payment.created_at::text AS "createdAt"
       FROM application_payments payment
       JOIN applications application ON application.id=payment.application_id
       LEFT JOIN application_preferences preference ON preference.application_id=application.id
       LEFT JOIN branches branch ON branch.id=preference.branch_id
       WHERE application.tenant_id=$1
       ORDER BY COALESCE(payment.paid_at,payment.created_at) DESC, payment.id DESC
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
