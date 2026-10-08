import { apiHandler, one, pageLimit } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { studentSchema, studentUpdateSchema } from "@/server/validation";

type StudentRow = {
  id: string;
  name: string;
  branchName: string;
  grade: string;
  className: string;
  parentName: string;
  attendanceRate: number;
  enrollmentStatus: string;
  totalCount: string;
};

export default apiHandler<unknown>(
  { methods: ["GET", "POST", "PUT", "DELETE"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, context) => {
    const user = context.user!;
    const assertBranchAccess = async (id: string) => {
      if (user.role === "TEACHER" && user.branchId !== id) {
        throw new AppError(403, "FORBIDDEN", "Teachers can only manage learners at their own campus.");
      }
      const branch = await query<{ id: string }>("SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 LIMIT 1", [id, user.tenantId]);
      if (!branch.rows[0]) throw new AppError(422, "BRANCH_NOT_FOUND", "Select a current campus.");
    };
    if (req.method === "POST") {
      const input = studentSchema.parse(req.body);
      await assertBranchAccess(input.branchId);
      const saved = await query<StudentRow>(
        `INSERT INTO students (tenant_id,branch_id,name,date_of_birth,grade,class_name,parent_name,attendance_rate,enrollment_status)
         VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9)
         RETURNING id,name,'' AS "branchName",grade,class_name AS "className",parent_name AS "parentName",attendance_rate::float AS "attendanceRate",enrollment_status AS "enrollmentStatus",'1' AS "totalCount"`,
        [user.tenantId,input.branchId,input.name,input.dateOfBirth,input.grade,input.className,input.parentName,input.attendanceRate,input.enrollmentStatus],
      );
      res.status(201).json({ ok: true, data: saved.rows });
      return;
    }
    if (req.method === "PUT") {
      const input = studentUpdateSchema.parse(req.body);
      const existing = await query<{ branchId: string }>("SELECT branch_id AS \"branchId\" FROM students WHERE id=$1 AND tenant_id=$2", [input.id,user.tenantId]);
      if (!existing.rows[0]) throw new AppError(404, "STUDENT_NOT_FOUND", "That learner no longer exists.");
      await assertBranchAccess(input.branchId ?? existing.rows[0].branchId);
      const saved = await query<StudentRow>(
        `UPDATE students SET branch_id=COALESCE($3,branch_id),name=COALESCE($4,name),date_of_birth=COALESCE($5::date,date_of_birth),grade=COALESCE($6,grade),class_name=COALESCE($7,class_name),parent_name=COALESCE($8,parent_name),attendance_rate=COALESCE($9,attendance_rate),enrollment_status=COALESCE($10,enrollment_status),updated_at=now()
         WHERE id=$1 AND tenant_id=$2
         RETURNING id,name,'' AS "branchName",grade,class_name AS "className",parent_name AS "parentName",attendance_rate::float AS "attendanceRate",enrollment_status AS "enrollmentStatus",'1' AS "totalCount"`,
        [input.id,user.tenantId,input.branchId ?? null,input.name ?? null,input.dateOfBirth ?? null,input.grade ?? null,input.className ?? null,input.parentName ?? null,input.attendanceRate ?? null,input.enrollmentStatus ?? null],
      );
      res.status(200).json({ ok: true, data: saved.rows });
      return;
    }
    if (req.method === "DELETE") {
      const id = one(req.query.id);
      if (!id) throw new AppError(422, "STUDENT_REQUIRED", "Choose a learner to delete.");
      const existing = await query<{ branchId: string }>("SELECT branch_id AS \"branchId\" FROM students WHERE id=$1 AND tenant_id=$2", [id,user.tenantId]);
      if (!existing.rows[0]) throw new AppError(404, "STUDENT_NOT_FOUND", "That learner no longer exists.");
      await assertBranchAccess(existing.rows[0].branchId);
      await query("DELETE FROM students WHERE id=$1 AND tenant_id=$2", [id,user.tenantId]);
      res.status(200).json({ ok: true, data: { id } });
      return;
    }
    const limit = pageLimit(req.query.limit);
    const search = (one(req.query.search) ?? "").trim();
    const branchId = user.role === "TEACHER" ? user.branchId : one(req.query.branchId);
    const cursor = one(req.query.cursor);
    const result = await query<StudentRow>(
      `SELECT s.id, s.name, b.name AS "branchName", s.grade,
        s.class_name AS "className", s.parent_name AS "parentName",
        s.attendance_rate::float AS "attendanceRate",
        s.enrollment_status AS "enrollmentStatus", count(*) OVER()::text AS "totalCount"
       FROM students s JOIN branches b ON b.id = s.branch_id
       WHERE s.tenant_id = $1
         AND ($2::uuid IS NULL OR s.branch_id = $2::uuid)
         AND ($3 = '' OR to_tsvector('simple', s.name || ' ' || s.parent_name || ' ' || s.grade)
              @@ plainto_tsquery('simple', $3))
         AND ($4::uuid IS NULL OR s.id < $4::uuid)
       ORDER BY s.created_at DESC, s.id DESC LIMIT $5`,
      [user.tenantId, branchId ?? null, search, cursor ?? null, limit + 1],
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    res.status(200).json({
      ok: true,
      data: rows,
      meta: {
        nextCursor: hasMore ? rows.at(-1)?.id ?? null : null,
        total: Number(result.rows[0]?.totalCount ?? 0),
      },
    });
  },
);
