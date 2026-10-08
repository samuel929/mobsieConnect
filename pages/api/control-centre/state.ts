import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

const PRINCIPAL_KEYS = new Set([
  "schools", "branches", "teachers", "parents", "learners", "applications", "appCounts",
  "waitingList", "payments", "invoices", "conversations", "newsletters", "pushLog",
  "feedback", "albums", "products", "ordersList", "documentsList", "adminUsers", "rolePerms",
  "auditLog", "events", "counters", "customCal", "homeworkList", "docFolders", "reportRuns",
  "settings",
]);
const TEACHER_KEYS = new Set([
  "customCal", "homeworkList", "reportRuns",
]);

type StateRow = { state: Record<string, unknown>; revision: string; updatedAt: string };

function sanitizedState(input: unknown, role: "PRINCIPAL" | "TEACHER") {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError(422, "VALIDATION_ERROR", "State must be a JSON object.");
  }
  const json = JSON.stringify(input);
  if (Buffer.byteLength(json, "utf8") > 5 * 1024 * 1024) {
    throw new AppError(413, "STATE_TOO_LARGE", "Control Centre state exceeds the 5 MB limit.");
  }
  const allowed = role === "PRINCIPAL" ? PRINCIPAL_KEYS : TEACHER_KEYS;
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([key]) => allowed.has(key)),
  );
}

export default apiHandler<StateRow | null>(
  { methods: ["GET", "PUT"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, context) => {
    const user = context.user!;
    if (req.method === "GET") {
      const result = await query<StateRow>(
        `SELECT state, revision::text, updated_at::text AS "updatedAt"
         FROM control_centre_state WHERE tenant_id = $1`,
        [user.tenantId],
      );
      const row = result.rows[0];
      if (!row) {
        res.status(200).json({ ok: true, data: null });
        return;
      }
      if (user.role === "TEACHER") {
        row.state = sanitizedState(row.state, "TEACHER");
      }
      res.status(200).json({ ok: true, data: row });
      return;
    }

    const incoming = sanitizedState(req.body?.state, user.role);
    const existing = await query<StateRow>(
      `SELECT state, revision::text, updated_at::text AS "updatedAt"
       FROM control_centre_state WHERE tenant_id = $1`,
      [user.tenantId],
    );
    const merged =
      user.role === "TEACHER"
        ? { ...(existing.rows[0]?.state ?? {}), ...incoming }
        : incoming;
    const result = await query<StateRow>(
      `INSERT INTO control_centre_state (tenant_id, state, updated_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (tenant_id) DO UPDATE SET
         state = EXCLUDED.state,
         revision = control_centre_state.revision + 1,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING state, revision::text, updated_at::text AS "updatedAt"`,
      [user.tenantId, JSON.stringify(merged), user.id],
    );
    res.status(200).json({ ok: true, data: result.rows[0] });
  },
);
