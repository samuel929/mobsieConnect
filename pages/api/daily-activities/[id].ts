import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { dailyActivityUpdateSchema } from "@/server/validation";
import { publishRealtime } from "@/server/realtime";
import { requireDashboardPermission } from "@/server/auth";
import { requireTeacherScope } from "@/server/teacherScope";

export default apiHandler<unknown>(
  { methods: ["PUT", "DELETE"] },
  async (req, res, context) => {
    const user = context.user!;
    await requireDashboardPermission(user, "Daily activities");
    const teacherScope = await requireTeacherScope(user);
    const id = one(req.query.id);
    if (!id) throw new AppError(422, "ACTIVITY_REQUIRED", "An activity id is required.");
    if (req.method === "DELETE") {
      const removed = await query<{ id: string }>(
        `DELETE FROM daily_activities WHERE id=$1 AND tenant_id=$2
          AND ($3::uuid IS NULL OR $4::text='PRINCIPAL' OR (branch_id=$3 AND regexp_replace(lower(trim(class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($5)),'[_ -]+','','g'))) RETURNING id`,
        [id,user.tenantId,teacherScope?.branchId??user.branchId,user.role,teacherScope?.className??null],
      );
      if (!removed.rows[0]) throw new AppError(404, "ACTIVITY_NOT_FOUND", "This activity no longer exists.");
      publishRealtime("daily_activity", user.tenantId);
      res.status(200).json({ ok: true, data: removed.rows[0] });
      return;
    }
    const input = dailyActivityUpdateSchema.parse({ ...req.body, id });
    const current = await query<{ startTime: string; endTime: string; branchId: string; className: string }>(
      `SELECT branch_id AS "branchId",class_name AS "className", to_char(start_time, 'HH24:MI') AS "startTime", to_char(end_time, 'HH24:MI') AS "endTime"
       FROM daily_activities
       WHERE id=$1 AND tenant_id=$2
         AND ($3::uuid IS NULL OR $4::text='PRINCIPAL' OR (branch_id=$3 AND regexp_replace(lower(trim(class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($5)),'[_ -]+','','g')))`,
      [id, user.tenantId, teacherScope?.branchId??user.branchId, user.role,teacherScope?.className??null],
    );
    if (!current.rows[0]) throw new AppError(404, "ACTIVITY_NOT_FOUND", "This activity no longer exists.");
    const targetBranchId = input.branchId ?? current.rows[0].branchId;
    if (user.role === "TEACHER" && user.branchId !== targetBranchId) {
      throw new AppError(403, "FORBIDDEN", "Teachers can only move activities within their own branch.");
    }
    if (teacherScope && (input.className??current.rows[0].className).replace(/[_\s-]+/g,"").toLowerCase()!==teacherScope.className.replace(/[_\s-]+/g,"").toLowerCase()) {
      throw new AppError(403,"FORBIDDEN","Teachers can only update activities for their assigned class.");
    }
    if (input.branchId) {
      const branch = await query<{ id: string }>(
        "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 LIMIT 1",
        [input.branchId, user.tenantId],
      );
      if (!branch.rows[0]) {
        throw new AppError(422, "BRANCH_NOT_FOUND", "Select a current campus before saving this activity.");
      }
    }
    if ((input.endTime ?? current.rows[0].endTime) <= (input.startTime ?? current.rows[0].startTime)) {
      throw new AppError(422, "INVALID_ACTIVITY_TIME", "End time must be after the start time.");
    }
    const updated = await query(
      `UPDATE daily_activities SET
       branch_id=COALESCE($3::uuid,branch_id),class_name=COALESCE($4,class_name),activity_date=COALESCE($5::date,activity_date),activity_type=COALESCE($6,activity_type),
       title=COALESCE($7,title),description=CASE WHEN $8::boolean THEN $9 ELSE description END,icon=COALESCE($10,icon),color=COALESCE($11,color),
       start_time=COALESCE($12::time,start_time),end_time=COALESCE($13::time,end_time),updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND ($14::uuid IS NULL OR $15::text='PRINCIPAL' OR branch_id=$14)
       RETURNING id,branch_id AS "branchId",class_name AS "className",activity_date::text AS "activityDate",activity_type AS "activityType",title,description,icon,color,
        to_char(start_time,'HH24:MI') AS "startTime",to_char(end_time,'HH24:MI') AS "endTime"`,
      [id,user.tenantId,input.branchId ?? null,input.className ?? null,input.activityDate ?? null,input.activityType ?? null,input.title ?? null,
        Object.prototype.hasOwnProperty.call(input, "description"), input.description ?? null, input.icon ?? null,input.color ?? null,
        input.startTime ?? null,input.endTime ?? null,user.branchId,user.role],
    );
    if (!updated.rows[0]) throw new AppError(404, "ACTIVITY_NOT_FOUND", "This activity no longer exists.");
    publishRealtime("daily_activity", user.tenantId);
    res.status(200).json({ ok: true, data: updated.rows[0] });
  },
);
