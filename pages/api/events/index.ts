import { apiHandler, one, pageLimit, pageNumber } from "@/server/api";
import { query } from "@/server/db";
import { eventSchema } from "@/server/validation";
import { AppError } from "@/server/errors";
import { createAndSendNotification } from "@/server/expoPush";
import { publishRealtime } from "@/server/realtime";

type EventRow = {
  id: string;
  branchId: string | null;
  branchName: string | null;
  title: string;
  description: string | null;
  category: string;
  audience: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  totalCount?: string;
};

export default apiHandler<EventRow[]>(
  { methods: ["GET", "POST"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, context) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const tenantId = context.user!.tenantId;
    if (req.method === "POST") {
      if (context.user!.role !== "PRINCIPAL") throw new AppError(403, "FORBIDDEN", "Only principals can create events.");
      const input = eventSchema.parse(req.body);
      if (input.branchId) {
        const branch = await query<{ id: string }>(
          "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 LIMIT 1",
          [input.branchId, tenantId],
        );
        if (!branch.rows[0]) {
          throw new AppError(422, "BRANCH_NOT_FOUND", "Select a current campus before creating an event.");
        }
      }
      const result = await query<EventRow>(
        `INSERT INTO calendar_events (
          tenant_id, branch_id, title, description, category, audience,
          starts_at, ends_at, all_day, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, branch_id AS "branchId", NULL::text AS "branchName",
          title, description, category, audience, starts_at::text AS "startsAt",
          ends_at::text AS "endsAt", all_day AS "allDay"`,
        [
          tenantId,
          input.branchId ?? null,
          input.title,
          input.description ?? null,
          input.category,
          input.audience,
          input.startsAt,
          input.endsAt,
          input.allDay,
          context.user!.id,
        ],
      );
      const event=result.rows[0];
      await createAndSendNotification({tenantId,branchId:event.branchId,title:`New calendar date: ${event.title}`,body:input.description||`A new school calendar date has been added for ${new Date(event.startsAt).toLocaleDateString("en-ZA")}.`,sourceType:"CALENDAR_EVENT",sourceId:event.id,data:{screen:"Calendar",eventId:event.id}});
      publishRealtime("calendar", tenantId);
      res.status(201).json({ ok: true, data: result.rows });
      return;
    }
    const from = one(req.query.from) ?? new Date().toISOString();
    const to =
      one(req.query.to) ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const branchId = context.user!.role === "TEACHER"
      ? context.user!.branchId
      : one(req.query.branchId);
    const category = one(req.query.category);
    const limit = pageLimit(req.query.limit, 250);
    const page = pageNumber(req.query.page);
    const result = await query<EventRow>(
      `SELECT e.id, e.branch_id AS "branchId", b.name AS "branchName", e.title,
        e.description, e.category, e.audience, e.starts_at::text AS "startsAt",
        e.ends_at::text AS "endsAt", e.all_day AS "allDay",
        count(*) OVER()::text AS "totalCount"
       FROM calendar_events e
       LEFT JOIN branches b ON b.id = e.branch_id
       WHERE e.tenant_id = $1
         AND e.starts_at >= $2::timestamptz AND e.starts_at < $3::timestamptz
         AND ($4::uuid IS NULL OR e.branch_id = $4::uuid)
         AND ($5::text IS NULL OR e.category = $5)
       ORDER BY e.starts_at, e.id LIMIT $6 OFFSET $7`,
      [tenantId, from, to, branchId ?? null, category ?? null, limit, (page - 1) * limit],
    );
    const total = Number(result.rows[0]?.totalCount ?? 0);
    res.status(200).json({
      ok: true,
      data: result.rows,
      meta: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);
