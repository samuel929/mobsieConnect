import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { getParent } from "@/server/parentAuth";

export default apiHandler<Record<string, unknown>[]>({ methods: ["GET"], auth: false }, async (req, res) => {
  const parent = await getParent(req);
  const result = await query<Record<string, unknown>>(
    `SELECT i.id,i.invoice_number AS "invoiceNumber",i.description,
       i.amount_cents AS "amountCents",i.issued_on::text AS "issuedOn",i.due_on::text AS "dueOn",
       CASE WHEN i.status='DUE' AND i.due_on<current_date THEN 'OVERDUE' ELSE i.status END AS status,
       i.paid_at::text AS "paidAt",i.created_at::text AS "createdAt",b.name AS "branchName"
     FROM invoices i LEFT JOIN branches b ON b.id=i.branch_id
     WHERE i.tenant_id=$1 AND i.parent_account_id=$2 AND i.status<>'CANCELLED'
     ORDER BY i.issued_on DESC,i.created_at DESC`,
    [parent.tenantId, parent.id],
  );
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).json({ ok: true, data: result.rows });
});
