import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { getParent } from "@/server/parentAuth";
import { payFastConfig } from "@/server/payfast";

const bodySchema = z.object({ returnUrl: z.string().trim().optional() });

export default apiHandler<Record<string, unknown>>({ methods: ["POST"], auth: false }, async (req, res) => {
  const parent = await getParent(req);
  const id = z.string().uuid().parse(req.query.id);
  const input = bodySchema.parse(req.body ?? {});
  const invoice = await query<{ id: string; invoiceNumber: string; amountCents: number; status: string }>(
    `SELECT id,invoice_number AS "invoiceNumber",amount_cents AS "amountCents",status
     FROM invoices WHERE id=$1 AND tenant_id=$2 AND parent_account_id=$3 LIMIT 1`,
    [id, parent.tenantId, parent.id],
  );
  const row = invoice.rows[0];
  if (!row) throw new AppError(404, "INVOICE_NOT_FOUND", "This invoice is no longer available.");
  if (row.status === "PAID") throw new AppError(409, "INVOICE_ALREADY_PAID", "This invoice is already paid.");
  if (row.status === "CANCELLED") throw new AppError(409, "INVOICE_CANCELLED", "This invoice has been cancelled.");
  const requestedReturnUrl = input.returnUrl ?? "";
  const returnUrl = /^(mobsieconnect|exp|exps):\/\//i.test(requestedReturnUrl)
    ? requestedReturnUrl : "mobsieconnect://invoices/payment/return";
  const merchantPaymentId = `INV-${row.invoiceNumber}-${crypto.randomUUID().slice(0, 8)}`;
  const payment = await query<{ id: string }>(
    `INSERT INTO invoice_payments(invoice_id,merchant_payment_id,amount_cents,status,return_url)
     VALUES($1,$2,$3,'CREATED',$4) RETURNING id`,
    [row.id, merchantPaymentId, row.amountCents, returnUrl],
  );
  const config = payFastConfig();
  res.status(201).json({ ok: true, data: {
    checkoutUrl: `${config.appUrl}/api/payfast/checkout/?invoicePayment=${payment.rows[0].id}`,
    status: "CREATED",
  }});
});
