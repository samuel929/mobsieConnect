import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { requireTeacherScope } from "@/server/teacherScope";

export default apiHandler<unknown>({methods:["GET"],roles:["PRINCIPAL","TEACHER"]},async(_req,res,{user})=>{
  const teacherScope=await requireTeacherScope(user!);
  const scope=teacherScope?.branchId??null;
  const [overall,grades,dates,heatmap,branches,records]=await Promise.all([
    query(`SELECT COUNT(*)::int AS entries,COUNT(*) FILTER(WHERE status='PRESENT')::int AS present,
      COALESCE(ROUND(100.0*COUNT(*) FILTER(WHERE status='PRESENT')/NULLIF(COUNT(*),0),1),0)::float8 AS percentage
      FROM attendance_registers a WHERE tenant_id=$1 AND attendance_date>=date_trunc('month',now())::date AND ($2::uuid IS NULL OR branch_id=$2)
        AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM students s WHERE s.id=a.student_id AND (regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g') OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g'))))`,[user!.tenantId,scope,teacherScope?.className??null]),
    query(`SELECT s.grade,COUNT(*)::int AS entries,COALESCE(ROUND(100.0*COUNT(*) FILTER(WHERE a.status='PRESENT')/NULLIF(COUNT(*),0),1),0)::float8 AS percentage
      FROM attendance_registers a JOIN students s ON s.id=a.student_id WHERE a.tenant_id=$1 AND a.attendance_date>=date_trunc('month',now())::date AND ($2::uuid IS NULL OR a.branch_id=$2)
        AND ($3::text IS NULL OR regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g') OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g'))
      GROUP BY s.grade ORDER BY s.grade`,[user!.tenantId,scope,teacherScope?.className??null]),
    query<{date:string}>(`SELECT DISTINCT a.attendance_date::text AS date FROM attendance_registers a WHERE a.tenant_id=$1 AND ($2::uuid IS NULL OR a.branch_id=$2)
      AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM students s WHERE s.id=a.student_id AND (regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g') OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g')))) ORDER BY date DESC LIMIT 6`,[user!.tenantId,scope,teacherScope?.className??null]),
    query(`SELECT s.grade,a.attendance_date::text AS date,ROUND(100.0*COUNT(*) FILTER(WHERE a.status='PRESENT')/NULLIF(COUNT(*),0),1)::float8 AS percentage
      FROM attendance_registers a JOIN students s ON s.id=a.student_id WHERE a.tenant_id=$1 AND ($2::uuid IS NULL OR a.branch_id=$2)
        AND ($3::text IS NULL OR regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g') OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g'))
      GROUP BY s.grade,a.attendance_date ORDER BY a.attendance_date DESC,s.grade`,[user!.tenantId,scope,teacherScope?.className??null]),
    query(`SELECT b.id,b.name,b.city,COUNT(DISTINCT s.id) FILTER(WHERE s.enrollment_status IN ('ENROLLED','ACTIVE'))::int AS learners,
      COUNT(a.id)::int AS entries,COALESCE(ROUND(100.0*COUNT(a.id) FILTER(WHERE a.status='PRESENT')/NULLIF(COUNT(a.id),0),1),0)::float8 AS percentage,
      COUNT(a.id) FILTER(WHERE a.attendance_date=CURRENT_DATE AND a.status='ABSENT')::int AS "absentToday"
      FROM branches b LEFT JOIN students s ON s.branch_id=b.id LEFT JOIN attendance_registers a ON a.student_id=s.id AND a.attendance_date>=CURRENT_DATE-INTERVAL '6 days'
      WHERE b.tenant_id=$1 AND b.status<>'INACTIVE' AND ($2::uuid IS NULL OR b.id=$2)
        AND ($3::text IS NULL OR s.id IS NULL OR regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g') OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g'))
      GROUP BY b.id ORDER BY b.name`,[user!.tenantId,scope,teacherScope?.className??null]),
    query(`SELECT a.id,a.student_id AS "studentId",s.name AS "studentName",
      a.branch_id AS "branchId",b.name AS "branchName",s.grade,s.class_name AS "className",
      a.attendance_date::text AS date,a.status
      FROM attendance_registers a
      JOIN students s ON s.id=a.student_id
      JOIN branches b ON b.id=a.branch_id
      WHERE a.tenant_id=$1 AND ($2::uuid IS NULL OR a.branch_id=$2)
        AND ($3::text IS NULL OR
          regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g') OR
          regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($3)),'[_ -]+','','g'))
      ORDER BY a.attendance_date DESC,s.name`,[user!.tenantId,scope,teacherScope?.className??null]),
  ]);
  const selectedDates=dates.rows.map(row=>row.date).reverse();
  res.status(200).json({ok:true,data:{overall:overall.rows[0],grades:grades.rows,dates:selectedDates,
    heatmap:heatmap.rows.filter((row:any)=>selectedDates.includes(row.date)),branches:branches.rows,records:records.rows}});
});
