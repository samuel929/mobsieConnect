import { apiHandler, one, pageLimit, pageNumber } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

const MODELS = new Set([
  "branches", "teachers", "parents", "learners", "applications", "waitingList",
  "payments", "invoices", "conversations", "newsletters", "pushLog", "feedback",
  "albums", "products", "ordersList", "documentsList", "adminUsers", "auditLog",
  "events", "homeworkList", "reportRuns",
]);
const TEACHER_MODELS = new Set(["learners", "events", "homeworkList", "reportRuns"]);

type ModelRow = { value: Record<string, unknown>; totalCount: string };

export default apiHandler<Record<string, unknown>[]>(
  { methods: ["GET"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, context) => {
    const model = one(req.query.model) ?? "";
    if (!MODELS.has(model)) throw new AppError(404, "MODEL_NOT_FOUND", "Unknown data model.");
    if (context.user!.role === "TEACHER" && !TEACHER_MODELS.has(model)) {
      throw new AppError(403, "FORBIDDEN", "Teachers cannot access this model.");
    }
    const page = pageNumber(req.query.page);
    const limit = pageLimit(req.query.limit, 100);
    const search = (one(req.query.search) ?? "").trim();
    const sort = (one(req.query.sort) ?? "").replace(/[^a-zA-Z0-9_]/g, "");
    const direction = one(req.query.direction) === "desc" ? "DESC" : "ASC";
    const result = await query<ModelRow>(
      `WITH model_rows AS (
         SELECT value, ordinality
         FROM control_centre_state s,
         LATERAL jsonb_array_elements(COALESCE(s.state -> $2, '[]'::jsonb))
           WITH ORDINALITY AS item(value, ordinality)
         WHERE s.tenant_id = $1
       )
       SELECT value, count(*) OVER()::text AS "totalCount"
       FROM model_rows
       WHERE ($3 = '' OR value::text ILIKE '%' || $3 || '%')
       ORDER BY
         CASE WHEN $4 = '' THEN ordinality END,
         CASE WHEN $4 <> '' THEN value ->> $4 END ${direction},
         ordinality
       LIMIT $5 OFFSET $6`,
      [context.user!.tenantId, model, search, sort, limit, (page - 1) * limit],
    );
    const total = Number(result.rows[0]?.totalCount ?? 0);
    res.status(200).json({
      ok: true,
      data: result.rows.map((row: ModelRow) => row.value),
      meta: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);
