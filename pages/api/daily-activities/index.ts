import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { dailyActivitySchema } from "@/server/validation";
import { publishRealtime } from "@/server/realtime";

export default apiHandler<unknown>(
  { methods: ["GET", "POST"] },
  async (req, res, context) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const user = context.user!;
    const branchId = one(req.query.branchId);
    const className = one(req.query.className);
    const activityDate = one(req.query.date);
    if (req.method === "POST") {
      const input = dailyActivitySchema.parse(req.body);
      if (input.endTime <= input.startTime) {
        throw new AppError(422, "INVALID_ACTIVITY_TIME", "End time must be after the start time.");
      }
      if (user.role === "TEACHER" && user.branchId !== input.branchId) {
        throw new AppError(403, "FORBIDDEN", "Teachers can only manage their own branch.");
      }
      const branch = await query<{ id: string }>(
        "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 LIMIT 1",
        [input.branchId, user.tenantId],
      );
      if (!branch.rows[0]) {
        throw new AppError(422, "BRANCH_NOT_FOUND", "Select a current campus before creating an activity.");
      }
      const saved = await query(
        `INSERT INTO daily_activities (tenant_id,branch_id,class_name,activity_date,activity_type,title,description,icon,color,start_time,end_time,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::time,$11::time,$12)
         RETURNING id,branch_id AS "branchId",class_name AS "className",activity_date::text AS "activityDate",
          activity_type AS "activityType",title,description,icon,color,to_char(start_time,'HH24:MI') AS "startTime",to_char(end_time,'HH24:MI') AS "endTime"`,
        [user.tenantId,input.branchId,input.className,input.activityDate,input.activityType,input.title,
          input.description ?? null,input.icon,input.color,input.startTime,input.endTime,user.id],
      );
      publishRealtime("daily_activity", user.tenantId);
      res.status(201).json({ ok: true, data: saved.rows[0] });
      return;
    }
    const rows = await query(
      `SELECT d.id,d.branch_id AS "branchId",b.name AS "branchName",d.class_name AS "className",d.activity_date::text AS "activityDate",
       d.activity_type AS "activityType",d.title,d.description,d.icon,d.color,
       to_char(d.start_time,'HH24:MI') AS "startTime",to_char(d.end_time,'HH24:MI') AS "endTime"
       FROM daily_activities d JOIN branches b ON b.id=d.branch_id
       WHERE d.tenant_id=$1 AND ($2::uuid IS NULL OR d.branch_id=$2)
         AND ($3::text IS NULL OR lower(trim(d.class_name))=lower(trim($3)))
         AND ($4::date IS NULL OR d.activity_date=$4::date)
         AND ($5::uuid IS NULL OR $6::text='PRINCIPAL' OR d.branch_id=$5)
       ORDER BY d.activity_date DESC,d.start_time ASC`,
      [user.tenantId,branchId ?? null,className ?? null,activityDate ?? null,user.branchId,user.role],
    );
    res.status(200).json({ ok: true, data: rows.rows });
  },
);
