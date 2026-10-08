import { apiHandler, one, pageLimit, pageNumber } from "@/server/api";
import { query } from "@/server/db";

type AcademicRow = {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  term: number;
  year: number;
  score: number;
  grade: string;
  teacherComment: string | null;
  totalCount: string;
};

export default apiHandler<AcademicRow[]>(
  { methods: ["GET"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, context) => {
    const user = context.user!;
    const branchId = user.role === "TEACHER" ? user.branchId : one(req.query.branchId);
    const studentId = one(req.query.studentId);
    const year = Number(one(req.query.year) ?? new Date().getFullYear());
    const term = one(req.query.term) ? Number(one(req.query.term)) : null;
    const limit = pageLimit(req.query.limit, 200);
    const page = pageNumber(req.query.page);
    const result = await query<AcademicRow>(
      `SELECT a.id, a.student_id AS "studentId", s.name AS "studentName",
        a.subject, a.term, a.year, a.score::float, a.grade,
        a.teacher_comment AS "teacherComment", count(*) OVER()::text AS "totalCount"
       FROM academic_records a
       JOIN students s ON s.id = a.student_id
       WHERE a.tenant_id = $1
         AND ($2::uuid IS NULL OR s.branch_id = $2::uuid)
         AND ($3::uuid IS NULL OR a.student_id = $3::uuid)
         AND a.year = $4
         AND ($5::smallint IS NULL OR a.term = $5::smallint)
       ORDER BY s.name, a.subject LIMIT $6 OFFSET $7`,
      [user.tenantId, branchId ?? null, studentId ?? null, year, term, limit, (page - 1) * limit],
    );
    const total = Number(result.rows[0]?.totalCount ?? 0);
    res.status(200).json({
      ok: true,
      data: result.rows,
      meta: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);
