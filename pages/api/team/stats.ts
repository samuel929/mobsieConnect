import { apiHandler } from "@/server/api";
import { query } from "@/server/db";

type TeamStats = {
  totalStaff: number;
  newThisMonth: number;
  activeLearners: number;
  learnersPerStaff: number;
  averageExperienceYears: number;
  attendanceEntriesThisMonth: number;
};

export default apiHandler<TeamStats>({ methods:["GET"], roles:["PRINCIPAL"] }, async (_req,res,{user})=>{
  const result=await query<TeamStats>(`SELECT
    (SELECT COUNT(*)::int FROM team_members t WHERE t.tenant_id=$1) AS "totalStaff",
    (SELECT COUNT(*)::int FROM team_members t WHERE t.tenant_id=$1 AND t.created_at>=date_trunc('month',now())) AS "newThisMonth",
    (SELECT COUNT(*)::int FROM students s WHERE s.tenant_id=$1 AND s.enrollment_status IN ('ENROLLED','ACTIVE')) AS "activeLearners",
    CASE WHEN (SELECT COUNT(*) FROM team_members t WHERE t.tenant_id=$1)=0 THEN 0 ELSE ROUND(
      (SELECT COUNT(*)::numeric FROM students s WHERE s.tenant_id=$1 AND s.enrollment_status IN ('ENROLLED','ACTIVE')) /
      (SELECT COUNT(*)::numeric FROM team_members t WHERE t.tenant_id=$1),1
    )::float8 END AS "learnersPerStaff",
    COALESCE((SELECT ROUND(AVG(t.years_experience)::numeric,1)::float8 FROM team_members t WHERE t.tenant_id=$1),0) AS "averageExperienceYears",
    (SELECT COUNT(*)::int FROM attendance_registers a WHERE a.tenant_id=$1 AND a.attendance_date>=date_trunc('month',now())::date) AS "attendanceEntriesThisMonth"`,[user!.tenantId]);
  res.status(200).json({ok:true,data:result.rows[0]});
});
