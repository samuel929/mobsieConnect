import type { ParentSession } from "@/server/parentAuth";
import { query } from "@/server/db";

/** A timetable item returned to the Expo app. */
export type ParentDailyActivity = {
  id: string;
  title: string;
  detail: string | null;
  icon: string;
  color: string;
  startTime: string;
  endTime: string;
  activityDate: string;
  className: string;
  branchId: string;
  branchName: string;
};

/**
 * Returns the timetable for a parent's current branch. A parent can be linked
 * through either an enrolled learner or an in-progress application. When the
 * exact class is known it is preferred; otherwise the branch timetable is
 * returned so a newly approved/enrolled family is never shown an empty screen.
 */
export async function getParentDailyActivities(
  parent: Pick<ParentSession, "id" | "tenantId" | "name" | "email" | "phone">,
): Promise<ParentDailyActivity[]> {
  const result = await query<ParentDailyActivity>(
    `WITH parent_scope AS (
       SELECT DISTINCT
         s.branch_id,
         lower(trim(COALESCE(NULLIF(s.class_name, ''), NULLIF(s.grade, ''), ''))) AS class_name
       FROM students s
       LEFT JOIN applications a ON a.id = s.application_id
       WHERE s.tenant_id = $1
         AND (
           a.parent_account_id = $2
           OR lower(trim(s.parent_name)) = lower(trim($3))
           OR lower(trim(COALESCE(a.parent_email, ''))) = lower(trim($4))
           OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g') = regexp_replace($5, '\\D', '', 'g')
         )

       UNION

       SELECT DISTINCT
         p.branch_id,
         lower(trim(COALESCE(NULLIF(a.current_grade, ''), ''))) AS class_name
       FROM applications a
       JOIN application_preferences p ON p.application_id = a.id
       WHERE a.tenant_id = $1
         AND (
           a.parent_account_id = $2
           OR lower(trim(COALESCE(a.parent_name, ''))) = lower(trim($3))
           OR lower(trim(COALESCE(a.parent_email, ''))) = lower(trim($4))
           OR regexp_replace(COALESCE(a.parent_phone, ''), '\\D', '', 'g') = regexp_replace($5, '\\D', '', 'g')
         )
         AND p.branch_id IS NOT NULL
     ), visible_activities AS (
       SELECT
         d.id,
         d.title,
         d.description AS detail,
         d.icon,
         d.color,
         to_char(d.start_time, 'HH24:MI') AS "startTime",
         to_char(d.end_time, 'HH24:MI') AS "endTime",
         d.activity_date::text AS "activityDate",
         d.class_name AS "className",
         b.id AS "branchId",
         b.name AS "branchName",
         CASE WHEN EXISTS (
           SELECT 1
           FROM parent_scope scope
           WHERE scope.branch_id = d.branch_id
             AND scope.class_name <> ''
             AND scope.class_name = lower(trim(d.class_name))
         ) THEN 0 ELSE 1 END AS class_rank
       FROM daily_activities d
       JOIN branches b ON b.id = d.branch_id AND b.tenant_id = d.tenant_id
       WHERE d.tenant_id = $1
         AND EXISTS (
           SELECT 1 FROM parent_scope scope WHERE scope.branch_id = d.branch_id
         )
     ), selected_day AS (
       SELECT COALESCE(
         (SELECT "activityDate"::date FROM visible_activities WHERE "activityDate"::date = CURRENT_DATE LIMIT 1),
         (SELECT MAX("activityDate"::date) FROM visible_activities)
       ) AS activity_date
     ), selected_rank AS (
       SELECT MIN(class_rank) AS class_rank
       FROM visible_activities
       WHERE "activityDate"::date = (SELECT activity_date FROM selected_day)
     )
     SELECT id, title, detail, icon, color, "startTime", "endTime", "activityDate", "className", "branchId", "branchName"
     FROM visible_activities
     WHERE "activityDate"::date = (SELECT activity_date FROM selected_day)
       AND class_rank = (SELECT class_rank FROM selected_rank)
     ORDER BY "startTime" ASC, title ASC`,
    [parent.tenantId, parent.id, parent.name, parent.email, parent.phone],
  );

  return result.rows;
}
