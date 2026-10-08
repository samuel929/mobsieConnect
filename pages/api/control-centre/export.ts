import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import type { NextApiResponse } from "next";

const EXPORTABLE = new Set([
  "branches", "teachers", "parents", "learners", "applications", "waitingList",
  "payments", "invoices", "newsletters", "pushLog", "feedback", "albums", "products",
  "ordersList", "documentsList", "adminUsers", "auditLog", "events", "homeworkList",
  "reportRuns",
]);

function csvCell(value: unknown) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default apiHandler<string>(
  { methods: ["GET"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, context) => {
    const model = one(req.query.model) ?? "";
    if (!EXPORTABLE.has(model)) throw new AppError(422, "INVALID_EXPORT", "Unknown export model.");
    if (context.user!.role === "TEACHER" && !["learners", "homeworkList", "reportRuns", "events"].includes(model)) {
      throw new AppError(403, "FORBIDDEN", "Teachers cannot export this model.");
    }
    const result = await query<{ state: Record<string, unknown> }>(
      "SELECT state FROM control_centre_state WHERE tenant_id = $1",
      [context.user!.tenantId],
    );
    const rows = result.rows[0]?.state?.[model];
    const list = Array.isArray(rows) ? rows : [];
    const headers = Array.from(new Set(list.flatMap((row) => Object.keys(row ?? {}))));
    const csv = [
      headers.map(csvCell).join(","),
      ...list.map((row) => headers.map((header) => csvCell(row?.[header])).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mobsie-${model}.csv"`);
    (res as NextApiResponse).status(200).send(`\uFEFF${csv}`);
  },
);
