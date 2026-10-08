import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { getParent } from "@/server/parentAuth";
import { getParentDailyActivities } from "@/server/dailyActivities";
import { getParentEvents } from "@/server/parentScope";

type ControlCentreStateRow = { state: Record<string, unknown> };

function listFromState(state: Record<string, unknown> | undefined, key: string) {
  const value = state?.[key];
  return Array.isArray(value) ? value : [];
}

export default apiHandler<Record<string, unknown>>(
  { methods: ["GET"], auth: false },
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const parent = await getParent(req);
    const [
      students,
      applications,
      academics,
      attendance,
      events,
      notifications,
      forms,
      dailyActivities,
      messages,
      controlCentre,
      newsletters,
    ] = await Promise.all([
      query(`SELECT s.id,s.name,s.date_of_birth::text AS "dateOfBirth",s.grade,s.class_name AS "className",s.attendance_rate::float AS "attendanceRate",s.enrollment_status AS "enrollmentStatus",s.branch_id AS "branchId",b.name AS "branchName"
             FROM students s JOIN branches b ON b.id=s.branch_id LEFT JOIN applications a ON a.id=s.application_id
             WHERE s.tenant_id=$1
               AND (
                 a.parent_account_id=$2
                 OR lower(trim(s.parent_name))=lower(trim($3))
                 OR lower(trim(COALESCE(a.parent_email, '')))=lower(trim($4))
                 OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g')=regexp_replace($5, '\\D', '', 'g')
               )
             ORDER BY s.created_at DESC`, [parent.tenantId,parent.id,parent.name,parent.email,parent.phone]),
      query(`SELECT a.id,a.reference,a.child_name AS "childName",a.current_grade AS "currentGrade",a.status,ap.branch_id AS "branchId",b.name AS "branchName",ap.preferred_start_date::text AS "preferredStartDate"
             FROM applications a LEFT JOIN application_preferences ap ON ap.application_id=a.id LEFT JOIN branches b ON b.id=ap.branch_id
             WHERE a.tenant_id=$1
               AND (
                 a.parent_account_id=$2
                 OR lower(trim(COALESCE(a.parent_email, '')))=lower(trim($3))
                 OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g')=regexp_replace($4, '\\D', '', 'g')
               )
             ORDER BY a.created_at DESC`, [parent.tenantId,parent.id,parent.email,parent.phone]),
      query(`SELECT ar.student_id AS "studentId",ar.subject,ar.term,ar.year,
                    ar.score::float AS score,ar.grade,ar.teacher_comment AS "teacherComment"
               FROM academic_records ar
               JOIN students s ON s.id=ar.student_id
               LEFT JOIN applications a ON a.id=s.application_id
              WHERE ar.tenant_id=$1
                AND (
                  a.parent_account_id=$2
                  OR lower(trim(s.parent_name))=lower(trim($3))
                  OR lower(trim(COALESCE(a.parent_email, '')))=lower(trim($4))
                  OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g')=regexp_replace($5, '\\D', '', 'g')
                )
              ORDER BY ar.year DESC,ar.term DESC,ar.subject ASC`, [parent.tenantId,parent.id,parent.name,parent.email,parent.phone]),
      query(`SELECT r.student_id AS "studentId",r.attendance_date::text AS date,r.status
               FROM attendance_registers r
               JOIN students s ON s.id=r.student_id
               LEFT JOIN applications a ON a.id=s.application_id
              WHERE r.tenant_id=$1
                AND (
                  a.parent_account_id=$2
                  OR lower(trim(s.parent_name))=lower(trim($3))
                  OR lower(trim(COALESCE(a.parent_email, '')))=lower(trim($4))
                  OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g')=regexp_replace($5, '\\D', '', 'g')
                )
              ORDER BY r.attendance_date DESC LIMIT 365`, [parent.tenantId,parent.id,parent.name,parent.email,parent.phone]),
      getParentEvents(parent),
      // Keep the mobile feed compatible with older notification tables. The
      // notification payload is optional for the app UI; delivery/read state is
      // the important part of this query. Migration 017 adds the data column
      // for new dashboard sends, but this fallback must not take the complete
      // school feed offline while an existing database is being upgraded.
      query(`SELECT n.id,n.title,n.body,'{}'::jsonb AS data,n.created_at::text AS "createdAt",d.read_at::text AS "readAt"
             FROM mobile_notification_deliveries d JOIN mobile_notifications n ON n.id=d.notification_id
             WHERE d.parent_account_id=$1 ORDER BY n.created_at DESC LIMIT 100`, [parent.id]),
      query(`SELECT id,template_id AS "templateId",title,signed_at::text AS "signedAt",student_id AS "studentId",true AS completed
             FROM consent_form_completions WHERE tenant_id=$1 AND parent_account_id=$2 ORDER BY signed_at DESC`, [parent.tenantId,parent.id]),
      getParentDailyActivities(parent),
      query(`SELECT id,sender_type AS "senderType",sender_name AS "senderName",body,
                    read_at::text AS "readAt",created_at::text AS "createdAt"
               FROM parent_messages
              WHERE tenant_id=$1 AND parent_account_id=$2
              ORDER BY created_at ASC,id ASC LIMIT 200`, [parent.tenantId, parent.id]),
      query<ControlCentreStateRow>(
        `SELECT state FROM control_centre_state WHERE tenant_id=$1 LIMIT 1`,
        [parent.tenantId],
      ),
      query(`SELECT id,title,body,audience,published_at::text AS "publishedAt" FROM newsletters
             WHERE tenant_id=$1 AND (branch_id IS NULL OR branch_id=ANY(SELECT branch_id FROM students WHERE parent_account_id=$2))
             ORDER BY published_at DESC LIMIT 100`,[parent.tenantId,parent.id]),
    ]);
    const state = controlCentre.rows[0]?.state;
    res.status(200).json({ ok: true, data: {
      applications: applications.rows, students: students.rows, events,
      notifications: notifications.rows, forms: forms.rows, dailyActivities,
      academics: academics.rows,
      attendance: attendance.rows,
      messages: messages.rows,
      homework: listFromState(state, "homeworkList"),
      newsletters: newsletters.rows.length ? newsletters.rows : listFromState(state, "newsletters"),
      gallery: listFromState(state, "albums"),
    } });
  },
);
