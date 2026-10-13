import { z } from "zod";

import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { textPdf } from "@/server/simplePdf";

const querySchema = z.object({
  branch: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

type StateRow = { state: { invoices?: Record<string, unknown>[]; payments?: Record<string, unknown>[] } };
type BranchRow = { id: string; name: string };

const amount = (value: unknown) => Number(value || 0);
const money = (value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default apiHandler<never>({ methods: ["GET"], roles: ["PRINCIPAL"] }, async (req, res, { user }) => {
  const input = querySchema.parse({ branch: Array.isArray(req.query.branch) ? req.query.branch[0] : req.query.branch, period: Array.isArray(req.query.period) ? req.query.period[0] : req.query.period });
  const period = input.period ?? new Date().toISOString().slice(0, 7);
  const [stateResult, branchResult] = await Promise.all([
    query<StateRow>("SELECT state FROM control_centre_state WHERE tenant_id=$1", [user!.tenantId]),
    query<BranchRow>(`SELECT id,name FROM branches WHERE tenant_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY name`, [user!.tenantId,input.branch??null]),
  ]);
  const state = stateResult.rows[0]?.state ?? {};
  const invoices = Array.isArray(state.invoices) ? state.invoices : [];
  const payments = Array.isArray(state.payments) ? state.payments : [];
  const lines: string[] = [`Period: ${period}`, `Generated: ${new Date().toLocaleString("en-ZA")}`, ""];
  for (const branch of branchResult.rows) {
    const matches = (row: Record<string, unknown>) => String(row.branch || row.school || "").toLowerCase() === branch.name.toLowerCase();
    const branchInvoices = invoices.filter(matches);
    const branchPayments = payments.filter(matches).filter((row) => ["successful","paid","complete"].includes(String(row.status || "").toLowerCase()));
    const invoiced = branchInvoices.reduce((sum,row)=>sum+amount(row.amount),0);
    const collected = branchPayments.reduce((sum,row)=>sum+amount(row.amount),0);
    const outstanding = Math.max(0,invoiced-collected);
    lines.push(branch.name, `Invoices: ${branchInvoices.length}    Invoiced: ${money(invoiced)}`, `Successful payments: ${branchPayments.length}    Collected: ${money(collected)}`, `Outstanding: ${money(outstanding)}`, "");
  }
  const pdf = textPdf("Mobsie Connect - Campus Statement", lines);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="mobsie-statements-${period}.pdf"`);
  res.status(200).end(pdf);
});
