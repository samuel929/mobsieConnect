import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { requireTeacherScope } from "@/server/teacherScope";

export default apiHandler<unknown>({methods:["GET"],roles:["PRINCIPAL","TEACHER"]},async(_req,res,{user})=>{
  const teacherScope=await requireTeacherScope(user!);
  const scope=teacherScope?.branchId??null;
  const latest=await query<{year:number|null;term:number|null}>(`SELECT year::int,term::int FROM academic_records WHERE tenant_id=$1 ORDER BY year DESC,term DESC LIMIT 1`,[user!.tenantId]);
  const year=latest.rows[0]?.year??new Date().getFullYear();
  const term=latest.rows[0]?.term??null;
  const [completion,monthly]=await Promise.all([
    query(`SELECT COALESCE(NULLIF(s.grade,''),'Unassigned') AS grade,COUNT(DISTINCT s.id)::int AS learners,COUNT(DISTINCT a.student_id)::int AS completed,
      COALESCE(ROUND(100.0*COUNT(DISTINCT a.student_id)/NULLIF(COUNT(DISTINCT s.id),0),1),0)::float8 AS percentage
      FROM students s LEFT JOIN academic_records a ON a.student_id=s.id AND a.tenant_id=$1 AND a.year=$2 AND ($3::int IS NULL OR a.term=$3)
      WHERE s.tenant_id=$1 AND s.enrollment_status IN ('ENROLLED','ACTIVE') AND ($4::uuid IS NULL OR s.branch_id=$4)
        AND ($5::text IS NULL OR regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($5)),'[_ -]+','','g') OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($5)),'[_ -]+','','g'))
      GROUP BY COALESCE(NULLIF(s.grade,''),'Unassigned') ORDER BY grade`,[user!.tenantId,year,term,scope,teacherScope?.className??null]),
    query(`WITH months AS (SELECT generate_series(date_trunc('month',now())-INTERVAL '5 months',date_trunc('month',now()),INTERVAL '1 month') AS month)
      SELECT to_char(m.month,'Mon') AS label,COUNT(a.id)::int AS value FROM months m LEFT JOIN academic_records a ON a.tenant_id=$1 AND a.created_at>=m.month AND a.created_at<m.month+INTERVAL '1 month'
        AND EXISTS (SELECT 1 FROM students s WHERE s.id=a.student_id AND ($2::uuid IS NULL OR s.branch_id=$2) AND ($3::text IS NULL OR regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g') OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g')))
      GROUP BY m.month ORDER BY m.month`,[user!.tenantId,scope,teacherScope?.className??null]),
  ]);
  res.status(200).json({ok:true,data:{year,term,completion:completion.rows,monthly:monthly.rows}});
});
