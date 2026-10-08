import { apiHandler } from "@/server/api";
import { withTransaction } from "@/server/db";
import { attendanceRegisterSchema } from "@/server/validation";
import { AppError } from "@/server/errors";

export default apiHandler<{ saved: number }>(
  { methods: ["POST"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, context) => {
    const input = attendanceRegisterSchema.parse(req.body);
    const user = context.user!;
    if (user.role === "TEACHER" && user.branchId !== input.branchId) {
      res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Teachers can only capture their own branch." } });
      return;
    }
    await withTransaction(async (client) => {
      const valid = await client.query(
        `SELECT count(*)::int AS count FROM students
         WHERE tenant_id = $1 AND branch_id = $2 AND id = ANY($3::uuid[])`,
        [user.tenantId, input.branchId, input.entries.map((entry) => entry.studentId)],
      );
      if (valid.rows[0].count !== input.entries.length) {
        throw new AppError(422, "INVALID_STUDENTS", "One or more students do not belong to this branch.");
      }
      for (const entry of input.entries) {
        await client.query(
          `INSERT INTO attendance_registers
             (tenant_id, branch_id, student_id, attendance_date, status, captured_by)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (tenant_id, student_id, attendance_date) DO UPDATE SET
             status = EXCLUDED.status, captured_by = EXCLUDED.captured_by, updated_at = now()`,
          [user.tenantId, input.branchId, entry.studentId, input.attendanceDate, entry.status, user.id],
        );
      }
    });
    res.status(200).json({ ok: true, data: { saved: input.entries.length } });
  },
);
