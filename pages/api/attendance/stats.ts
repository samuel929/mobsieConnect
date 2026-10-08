import { apiHandler } from "@/server/api";
import { query } from "@/server/db";

export default apiHandler<unknown>({methods:["GET"],roles:["PRINCIPAL","TEACHER"]},async(_req,res,{user})=>{
  const scope=user!.role==="TEACHER"?user!.branchId:null;
  const [overall,grades,dates,heatmap,branches]=await Promise.all([
    query(`SELECT COUNT(*)::int AS entries,COUNT(*) FILTER(WHERE status='PRESENT')::int AS present,
      COALESCE(ROUND(100.0*COUNT(*) FILTER(WHERE status='PRESENT')/NULLIF(COUNT(*),0),1),0)::float8 AS percentage
      FROM attendance_registers WHERE tenant_id=$1 AND attendance_date>=date_trunc('month',now())::date AND ($2::uuid IS NULL OR branch_id=$2)`,[user!.tenantId,scope]),
    query(`SELECT s.grade,COUNT(*)::int AS entries,COALESCE(ROUND(100.0*COUNT(*) FILTER(WHERE a.status='PRESENT')/NULLIF(COUNT(*),0),1),0)::float8 AS percentage
      FROM attendance_registers a JOIN students s ON s.id=a.student_id WHERE a.tenant_id=$1 AND a.attendance_date>=date_trunc('month',now())::date AND ($2::uuid IS NULL OR a.branch_id=$2)
      GROUP BY s.grade ORDER BY s.grade`,[user!.tenantId,scope]),
    query<{date:string}>(`SELECT DISTINCT attendance_date::text AS date FROM attendance_registers WHERE tenant_id=$1 AND ($2::uuid IS NULL OR branch_id=$2) ORDER BY date DESC LIMIT 6`,[user!.tenantId,scope]),
    query(`SELECT s.grade,a.attendance_date::text AS date,ROUND(100.0*COUNT(*) FILTER(WHERE a.status='PRESENT')/NULLIF(COUNT(*),0),1)::float8 AS percentage
      FROM attendance_registers a JOIN students s ON s.id=a.student_id WHERE a.tenant_id=$1 AND ($2::uuid IS NULL OR a.branch_id=$2)
      GROUP BY s.grade,a.attendance_date ORDER BY a.attendance_date DESC,s.grade`,[user!.tenantId,scope]),
    query(`SELECT b.id,b.name,b.city,COUNT(DISTINCT s.id) FILTER(WHERE s.enrollment_status IN ('ENROLLED','ACTIVE'))::int AS learners,
      COUNT(a.id)::int AS entries,COALESCE(ROUND(100.0*COUNT(a.id) FILTER(WHERE a.status='PRESENT')/NULLIF(COUNT(a.id),0),1),0)::float8 AS percentage,
      COUNT(a.id) FILTER(WHERE a.attendance_date=CURRENT_DATE AND a.status='ABSENT')::int AS "absentToday"
      FROM branches b LEFT JOIN students s ON s.branch_id=b.id LEFT JOIN attendance_registers a ON a.student_id=s.id AND a.attendance_date>=CURRENT_DATE-INTERVAL '6 days'
      WHERE b.tenant_id=$1 AND b.status<>'INACTIVE' AND ($2::uuid IS NULL OR b.id=$2)
      GROUP BY b.id ORDER BY b.name`,[user!.tenantId,scope]),
  ]);
  const selectedDates=dates.rows.map(row=>row.date).reverse();
  res.status(200).json({ok:true,data:{overall:overall.rows[0],grades:grades.rows,dates:selectedDates,
    heatmap:heatmap.rows.filter((row:any)=>selectedDates.includes(row.date)),branches:branches.rows}});
});
