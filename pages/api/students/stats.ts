import { apiHandler } from "@/server/api";
import { query } from "@/server/db";

type LearnerStats = {
  totalLearners: number;
  activeLearners: number;
  addedThisMonth: number;
  activePercentage: number;
  monthly?: Array<{ label:string; total:number; added:number }>;
};

export default apiHandler<LearnerStats>({ methods: ["GET"], roles: ["PRINCIPAL", "TEACHER"] }, async (_req, res, { user }) => {
  const branchId = user!.role === "TEACHER" ? user!.branchId : null;
  const [result, monthly] = await Promise.all([query<LearnerStats>(
    `SELECT COUNT(*)::int AS "totalLearners",
       COUNT(*) FILTER (WHERE enrollment_status IN ('ENROLLED','ACTIVE'))::int AS "activeLearners",
       COUNT(*) FILTER (WHERE created_at >= date_trunc('month',now()))::int AS "addedThisMonth",
       COALESCE(ROUND(100.0*COUNT(*) FILTER (WHERE enrollment_status IN ('ENROLLED','ACTIVE'))/NULLIF(COUNT(*),0),1),0)::float8 AS "activePercentage"
     FROM students WHERE tenant_id=$1 AND ($2::uuid IS NULL OR branch_id=$2)`,
    [user!.tenantId, branchId],
  ), query<{ label:string; total:number; added:number }>(`WITH months AS (
      SELECT generate_series(date_trunc('month',now())-INTERVAL '5 months',date_trunc('month',now()),INTERVAL '1 month') AS month
    ) SELECT to_char(months.month,'Mon') AS label,
      COUNT(student.id) FILTER (WHERE student.created_at<months.month+INTERVAL '1 month')::int AS total,
      COUNT(student.id) FILTER (WHERE student.created_at>=months.month AND student.created_at<months.month+INTERVAL '1 month')::int AS added
    FROM months LEFT JOIN students student ON student.tenant_id=$1 AND ($2::uuid IS NULL OR student.branch_id=$2)
    GROUP BY months.month ORDER BY months.month`, [user!.tenantId, branchId])]);
  res.status(200).json({ ok: true, data: { ...result.rows[0], monthly: monthly.rows } });
});
