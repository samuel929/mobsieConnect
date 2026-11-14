import { z } from "zod";

import { apiHandler, one } from "@/server/api";
import { requireDashboardPermission } from "@/server/auth";
import { query } from "@/server/db";

const schema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

type TotalsRow = {
  applications: number;
  documentsComplete: number;
  approved: number;
  enrolled: number;
  pendingReview: number;
};

type CampusRow = {
  branchId: string;
  branchName: string;
  city: string;
  applications: number;
};

type DecisionRow = {
  averageDecisionDays: number | null;
  fastestCampus: string | null;
  fastestCampusDays: number | null;
};

export default apiHandler<unknown>(
  { methods: ["GET"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    await requireDashboardPermission(user!, "Admissions");
    const input = schema.parse({ period: one(req.query.period) });
    const period = input.period ?? new Date().toISOString().slice(0, 7);
    const params = [user!.tenantId, `${period}-01`];

    const [totalsResult, campusResult, decisionResult] = await Promise.all([
      query<TotalsRow>(
        `WITH bounds AS (
           SELECT $2::date AS starts_at, ($2::date + interval '1 month') AS ends_at
         ), monthly AS (
           SELECT a.id, a.status::text AS status
           FROM applications a CROSS JOIN bounds
           WHERE a.tenant_id=$1
             AND a.status<>'DRAFT'
             AND COALESCE(a.submitted_at,a.created_at)>=bounds.starts_at
             AND COALESCE(a.submitted_at,a.created_at)<bounds.ends_at
         ), documents AS (
           SELECT m.id,
             COUNT(DISTINCT d.kind) FILTER (
               WHERE d.review_status='APPROVED'
                 AND d.kind::text IN ('LEARNER_PHOTO','BIRTH_CERTIFICATE','PARENT_ID','CLINIC_CARD','PROOF_OF_ADDRESS','PROOF_OF_INCOME')
             )::int AS approved_required
           FROM monthly m LEFT JOIN application_documents d ON d.application_id=m.id
           GROUP BY m.id
         ), enrolled AS (
           SELECT DISTINCT s.application_id
           FROM students s
           WHERE s.tenant_id=$1 AND s.enrollment_status='ENROLLED' AND s.application_id IS NOT NULL
         )
         SELECT
           COUNT(*)::int AS applications,
           COUNT(*) FILTER (WHERE documents.approved_required=6)::int AS "documentsComplete",
           COUNT(*) FILTER (WHERE monthly.status IN ('APPROVED','ENROLLED') OR enrolled.application_id IS NOT NULL)::int AS approved,
           COUNT(*) FILTER (WHERE enrolled.application_id IS NOT NULL)::int AS enrolled,
           COUNT(*) FILTER (WHERE monthly.status='PENDING_REVIEW')::int AS "pendingReview"
         FROM monthly
         LEFT JOIN documents ON documents.id=monthly.id
         LEFT JOIN enrolled ON enrolled.application_id=monthly.id`,
        params,
      ),
      query<CampusRow>(
        `WITH bounds AS (
           SELECT $2::date AS starts_at, ($2::date + interval '1 month') AS ends_at
         ), intake AS (
           SELECT p.branch_id, COUNT(*)::int AS applications
           FROM applications a
           JOIN application_preferences p ON p.application_id=a.id
           CROSS JOIN bounds
           WHERE a.tenant_id=$1 AND a.status<>'DRAFT'
             AND COALESCE(a.submitted_at,a.created_at)>=bounds.starts_at
             AND COALESCE(a.submitted_at,a.created_at)<bounds.ends_at
           GROUP BY p.branch_id
         )
         SELECT b.id AS "branchId", b.name AS "branchName", b.city,
           COALESCE(intake.applications,0)::int AS applications
         FROM branches b LEFT JOIN intake ON intake.branch_id=b.id
         WHERE b.tenant_id=$1 AND b.status<>'INACTIVE'
         ORDER BY COALESCE(intake.applications,0) DESC, b.name`,
        params,
      ),
      query<DecisionRow>(
        `WITH bounds AS (
           SELECT $2::date AS starts_at, ($2::date + interval '1 month') AS ends_at
         ), decisions AS (
           SELECT b.name AS branch_name,
             EXTRACT(EPOCH FROM (
               CASE a.status::text
                 WHEN 'APPROVED' THEN COALESCE(a.approval_email_sent_at,a.updated_at)
                 WHEN 'REJECTED' THEN COALESCE(a.declined_email_sent_at,a.updated_at)
                 WHEN 'WAITLISTED' THEN COALESCE(a.waiting_list_email_sent_at,a.updated_at)
                 ELSE a.updated_at
               END - a.submitted_at
             )) / 86400.0 AS days
           FROM applications a
           LEFT JOIN application_preferences p ON p.application_id=a.id
           LEFT JOIN branches b ON b.id=p.branch_id
           CROSS JOIN bounds
           WHERE a.tenant_id=$1 AND a.submitted_at IS NOT NULL
             AND a.status IN ('APPROVED','ENROLLED','REJECTED','WAITLISTED')
             AND COALESCE(a.submitted_at,a.created_at)>=bounds.starts_at
             AND COALESCE(a.submitted_at,a.created_at)<bounds.ends_at
         ), campus AS (
           SELECT branch_name, AVG(GREATEST(days,0)) AS average_days
           FROM decisions WHERE branch_name IS NOT NULL GROUP BY branch_name
         )
         SELECT
           (SELECT ROUND(AVG(GREATEST(days,0))::numeric,1)::float8 FROM decisions) AS "averageDecisionDays",
           (SELECT branch_name FROM campus ORDER BY average_days,branch_name LIMIT 1) AS "fastestCampus",
           (SELECT ROUND(average_days::numeric,1)::float8 FROM campus ORDER BY average_days,branch_name LIMIT 1) AS "fastestCampusDays"`,
        params,
      ),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        period,
        totals: totalsResult.rows[0] ?? {
          applications: 0, documentsComplete: 0,
          approved: 0, enrolled: 0, pendingReview: 0,
        },
        campuses: campusResult.rows,
        decisions: decisionResult.rows[0] ?? {
          averageDecisionDays: null, fastestCampus: null, fastestCampusDays: null,
        },
      },
    });
  },
);
