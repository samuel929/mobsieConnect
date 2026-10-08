import { z } from "zod";

import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  sendApplicationApprovedEmail,
  sendApplicationDeclinedEmail,
  sendApplicationInterviewEmail,
  sendApplicationWaitingListEmail,
} from "@/server/admissionsMailer";

const statusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "PENDING_REVIEW",
    "DOCUMENTS_REQUIRED",
    "INTERVIEW_SCHEDULED",
    "APPROVED",
    "REJECTED",
    "WAITLISTED",
    "ENROLLED",
  ]),
  interviewDate: z.string().trim().max(80).nullable().optional(),
  interviewTime: z.string().trim().max(40).nullable().optional(),
  teamName: z.string().trim().max(120).nullable().optional(),
});

type ApplicationStatusRow = {
  id: string;
  reference: string;
  status: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  branchName: string | null;
  approvalEmailSentAt: string | null;
  waitingListEmailSentAt: string | null;
  interviewEmailSentAt: string | null;
  declinedEmailSentAt: string | null;
};

export default apiHandler<Record<string, unknown>>(
  { methods: ["PUT"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const identifier = one(req.query.id);
    if (!identifier) {
      throw new AppError(400, "APPLICATION_ID_REQUIRED", "Application ID is required.");
    }
    const input = statusSchema.parse(req.body);

    const existing = await query<ApplicationStatusRow>(
      `SELECT
         a.id,
         a.reference,
         a.status::text,
         a.parent_name AS "parentName",
         a.parent_email::text AS "parentEmail",
         a.child_name AS "childName",
         b.name AS "branchName",
         a.approval_email_sent_at::text AS "approvalEmailSentAt",
         a.waiting_list_email_sent_at::text AS "waitingListEmailSentAt"
         ,a.interview_email_sent_at::text AS "interviewEmailSentAt"
         ,a.declined_email_sent_at::text AS "declinedEmailSentAt"
       FROM applications a
       LEFT JOIN application_preferences p ON p.application_id = a.id
       LEFT JOIN branches b ON b.id = p.branch_id
       WHERE a.tenant_id = $1
         AND (a.id::text = $2 OR a.reference = $2)
       LIMIT 1`,
      [user!.tenantId, identifier],
    );
    const application = existing.rows[0];
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found.");
    }

    await query(
      `UPDATE applications
       SET status = $2::application_status,
           approval_email_sent_at = CASE
             WHEN $2 = 'APPROVED' THEN approval_email_sent_at
             ELSE NULL
           END,
           waiting_list_email_sent_at = CASE
             WHEN $2 = 'WAITLISTED' THEN waiting_list_email_sent_at
             ELSE NULL
           END,
           interview_email_sent_at = CASE
             WHEN $2 = 'INTERVIEW_SCHEDULED' THEN interview_email_sent_at
             ELSE NULL
           END,
           declined_email_sent_at = CASE
             WHEN $2 = 'REJECTED' THEN declined_email_sent_at
             ELSE NULL
           END
       WHERE id = $1`,
      [application.id, input.status],
    );

    let emailSent = Boolean(application.approvalEmailSentAt);
    if (input.status === "APPROVED" && !application.approvalEmailSentAt) {
      await sendApplicationApprovedEmail({
        to: application.parentEmail,
        parentName: application.parentName,
        childName: application.childName,
      });
      await query(
        "UPDATE applications SET approval_email_sent_at = now() WHERE id = $1",
        [application.id],
      );
      emailSent = true;
    }
    if (input.status === "WAITLISTED" && !application.waitingListEmailSentAt) {
      const waitingList = await query<{ position: number; total: number }>(
        `SELECT
           1 + COUNT(*) FILTER (WHERE COALESCE(submitted_at,created_at) < COALESCE($3::timestamptz,now()))::int AS position,
           COUNT(*)::int AS total
         FROM applications
         WHERE tenant_id=$1 AND status='WAITLISTED' AND id<>$2`,
        [user!.tenantId, application.id, null],
      );
      const position = Number(waitingList.rows[0]?.position ?? 1);
      const total = Number(waitingList.rows[0]?.total ?? 0) + 1;
      await sendApplicationWaitingListEmail({
        to: application.parentEmail,
        parentName: application.parentName,
        childName: application.childName,
        position,
        total,
      });
      await query(
        "UPDATE applications SET waiting_list_email_sent_at = now() WHERE id = $1",
        [application.id],
      );
      emailSent = true;
    }
    if (input.status === "INTERVIEW_SCHEDULED" && !application.interviewEmailSentAt) {
      await sendApplicationInterviewEmail({
        to: application.parentEmail,
        parentName: application.parentName,
        childName: application.childName,
        interviewDate: input.interviewDate,
        interviewTime: input.interviewTime,
        teamName: input.teamName,
      });
      await query("UPDATE applications SET interview_email_sent_at=now() WHERE id=$1", [application.id]);
      emailSent = true;
    }
    if (input.status === "REJECTED" && !application.declinedEmailSentAt) {
      await sendApplicationDeclinedEmail({
        to: application.parentEmail,
        parentName: application.parentName,
        childName: application.childName,
      });
      await query("UPDATE applications SET declined_email_sent_at=now() WHERE id=$1", [application.id]);
      emailSent = true;
    }

    res.status(200).json({
      ok: true,
      data: {
        id: application.id,
        reference: application.reference,
        status: input.status,
        emailSent,
      },
    });
  },
);
