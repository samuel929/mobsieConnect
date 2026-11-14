import { query } from "@/server/db";

export type StatementRow = {
  branchId:string;
  school:string;
  invoiceCount:number;
  paymentCount:number;
  invoicedCents:number;
  collectedCents:number;
  outstandingCents:number;
};

export async function getStatementRows(tenantId:string,period:string,branchId?:string){
  const rows=await query<StatementRow>(`WITH bounds AS (
      SELECT $2::date AS starts_at,($2::date+INTERVAL '1 month') AS ends_at
    ), completed_payments AS (
      SELECT preference.branch_id,COALESCE(payment.amount_gross_cents,payment.amount_cents)::bigint AS amount_cents
      FROM application_payments payment
      JOIN applications application ON application.id=payment.application_id AND application.tenant_id=$1
      LEFT JOIN application_preferences preference ON preference.application_id=application.id
      CROSS JOIN bounds
      WHERE payment.status='COMPLETE' AND payment.paid_at>=bounds.starts_at AND payment.paid_at<bounds.ends_at
      UNION ALL
      SELECT shop_order.branch_id,COALESCE(payment.amount_gross_cents,payment.amount_cents)::bigint
      FROM shop_order_payments payment
      JOIN shop_orders shop_order ON shop_order.id=payment.order_id AND shop_order.tenant_id=$1
      CROSS JOIN bounds
      WHERE payment.status='COMPLETE' AND payment.paid_at>=bounds.starts_at AND payment.paid_at<bounds.ends_at
    ), payment_totals AS (
      SELECT branch_id,COUNT(*)::int AS payment_count,COALESCE(SUM(amount_cents),0)::bigint AS collected_cents
      FROM completed_payments GROUP BY branch_id
    ), invoice_totals AS (
      SELECT invoice.branch_id,
        COUNT(*) FILTER(WHERE invoice.issued_on>=bounds.starts_at AND invoice.issued_on<bounds.ends_at)::int AS invoice_count,
        COALESCE(SUM(invoice.amount_cents) FILTER(WHERE invoice.issued_on>=bounds.starts_at AND invoice.issued_on<bounds.ends_at),0)::bigint AS invoiced_cents,
        COALESCE(SUM(invoice.amount_cents) FILTER(WHERE invoice.status<>'CANCELLED' AND invoice.issued_on<bounds.ends_at AND (invoice.paid_at IS NULL OR invoice.paid_at>=bounds.ends_at)),0)::bigint AS outstanding_cents
      FROM invoices invoice CROSS JOIN bounds WHERE invoice.tenant_id=$1 GROUP BY invoice.branch_id
    ) SELECT branch.id AS "branchId",branch.name AS school,
      COALESCE(invoice.invoice_count,0)::int AS "invoiceCount",COALESCE(payment.payment_count,0)::int AS "paymentCount",
      COALESCE(invoice.invoiced_cents,0)::float8 AS "invoicedCents",COALESCE(payment.collected_cents,0)::float8 AS "collectedCents",
      COALESCE(invoice.outstanding_cents,0)::float8 AS "outstandingCents"
    FROM branches branch
    LEFT JOIN invoice_totals invoice ON invoice.branch_id=branch.id
    LEFT JOIN payment_totals payment ON payment.branch_id=branch.id
    WHERE branch.tenant_id=$1 AND branch.status<>'INACTIVE' AND ($3::uuid IS NULL OR branch.id=$3)
    ORDER BY branch.name`,[tenantId,`${period}-01`,branchId??null]);
  return rows.rows;
}
