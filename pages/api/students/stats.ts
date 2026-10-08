import { apiHandler } from "@/server/api";
import { query } from "@/server/db";

type LearnerStats = {
  totalLearners: number;
  activeLearners: number;
  addedThisMonth: number;
  activePercentage: number;
};

export default apiHandler<LearnerStats>({ methods: ["GET"], roles: ["PRINCIPAL", "TEACHER"] }, async (_req, res, { user }) => {
  const branchId = user!.role === "TEACHER" ? user!.branchId : null;
  const result = await query<LearnerStats>(
    `SELECT COUNT(*)::int AS "totalLearners",
       COUNT(*) FILTER (WHERE enrollment_status IN ('ENROLLED','ACTIVE'))::int AS "activeLearners",
       COUNT(*) FILTER (WHERE created_at >= date_trunc('month',now()))::int AS "addedThisMonth",
       COALESCE(ROUND(100.0*COUNT(*) FILTER (WHERE enrollment_status IN ('ENROLLED','ACTIVE'))/NULLIF(COUNT(*),0),1),0)::float8 AS "activePercentage"
     FROM students WHERE tenant_id=$1 AND ($2::uuid IS NULL OR branch_id=$2)`,
    [user!.tenantId, branchId],
  );
  res.status(200).json({ ok: true, data: result.rows[0] });
});
