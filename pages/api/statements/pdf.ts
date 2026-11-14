import { z } from "zod";

import { apiHandler } from "@/server/api";
import { textPdf } from "@/server/simplePdf";
import { requireDashboardPermission } from "@/server/auth";
import { getStatementRows } from "@/server/statements";

const querySchema = z.object({
  branch: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const money = (value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default apiHandler<never>({ methods: ["GET"], roles: ["PRINCIPAL"] }, async (req, res, { user }) => {
  const input = querySchema.parse({ branch: Array.isArray(req.query.branch) ? req.query.branch[0] : req.query.branch, period: Array.isArray(req.query.period) ? req.query.period[0] : req.query.period });
  await requireDashboardPermission(user!,"Finance");
  const period = input.period ?? new Date().toISOString().slice(0, 7);
  const statements=await getStatementRows(user!.tenantId,period,input.branch);
  const lines: string[] = [`Period: ${period}`, `Generated: ${new Date().toLocaleString("en-ZA")}`, ""];
  for (const statement of statements) {
    lines.push(statement.school,
      `Invoices: ${statement.invoiceCount}    Invoiced: ${money(statement.invoicedCents/100)}`,
      `Successful payments: ${statement.paymentCount}    Collected: ${money(statement.collectedCents/100)}`,
      `Outstanding invoices: ${money(statement.outstandingCents/100)}`, "");
  }
  const pdf = textPdf("Mobsie Connect - Campus Statement", lines);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="mobsie-statements-${period}.pdf"`);
  res.status(200).end(pdf);
});
