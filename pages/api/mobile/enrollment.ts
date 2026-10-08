import bcrypt from "bcryptjs";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { getParent } from "@/server/parentAuth";
import { mobileEnrollmentSchema } from "@/server/validation";
import { sendApplicationReceivedEmail } from "@/server/admissionsMailer";

export default apiHandler<Record<string, unknown>>(
  { methods: ["GET", "POST"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    if (req.method === "GET") {
      const requestedReference = Array.isArray(req.query.reference)
        ? req.query.reference[0]
        : req.query.reference;
      const current = await query<Record<string, unknown>>(
        `SELECT a.id,a.reference,a.child_name AS "childName",a.status::text,
                p.branch_id AS "branchId",b.name AS "branchName",
                p.school_type AS "schoolType",p.school_stage AS "schoolStage",
                p.preferred_start_date::text AS "preferredStartDate",
                p.enrollment_type AS "enrollmentType",
                COALESCE(p.aftercare_requested,false) AS "aftercareRequested",
                EXISTS(SELECT 1 FROM mobile_enrollments me WHERE me.application_id=a.id) AS "enrollmentComplete"
           FROM applications a
           JOIN application_preferences p ON p.application_id=a.id
           LEFT JOIN branches b ON b.id=p.branch_id
          WHERE a.tenant_id=$1
            AND (a.parent_account_id=$2 OR lower(a.parent_email::text)=lower($3))
            AND ($4::text IS NULL OR a.reference=$4)
          ORDER BY a.created_at DESC
          LIMIT 1`,
        [parent.tenantId, parent.id, parent.email, requestedReference || null],
      );
      if (!current.rows[0]) {
        throw new AppError(404, "APPLICATION_NOT_FOUND", "No submitted application was found for this account.");
      }
      res.status(200).json({ ok: true, data: current.rows[0] });
      return;
    }
    const input = mobileEnrollmentSchema.parse(req.body);
    const application = await query<Record<string, unknown>>(
      `SELECT a.id,a.child_name,a.child_date_of_birth,a.current_grade,a.status,p.branch_id
       FROM applications a JOIN application_preferences p ON p.application_id=a.id
       WHERE a.id=$1 AND a.tenant_id=$2
         AND (a.parent_account_id=$3 OR a.parent_email=$4) LIMIT 1`,
      [input.applicationId, parent.tenantId, parent.id, parent.email],
    );
    const item = application.rows[0];
    if (!item) throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found.");
    if (!["PENDING_REVIEW", "APPROVED", "ENROLLED"].includes(String(item.status))) {
      throw new AppError(422, "SUBMIT_FIRST", "Submit the application before enrolment.");
    }
    const hash = await bcrypt.hash(input.pickupPassword, 12);
    await query(
      `INSERT INTO mobile_enrollments
         (application_id,parent_account_id,pickup_password_hash,primary_collector,secondary_collector)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (application_id) DO UPDATE SET
         pickup_password_hash=EXCLUDED.pickup_password_hash,
         primary_collector=EXCLUDED.primary_collector,
         secondary_collector=EXCLUDED.secondary_collector,
         confirmed_at=now()`,
      [input.applicationId, parent.id, hash, input.primaryCollector, input.secondaryCollector ?? null],
    );
    const student = await query<Record<string, unknown>>(
      `INSERT INTO students
         (tenant_id,branch_id,application_id,parent_account_id,name,date_of_birth,grade,class_name,parent_name,attendance_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,0)
       ON CONFLICT (application_id) DO UPDATE SET
         branch_id=EXCLUDED.branch_id,parent_account_id=EXCLUDED.parent_account_id,
         grade=EXCLUDED.grade,parent_name=EXCLUDED.parent_name,updated_at=now()
       RETURNING id,name,grade,class_name AS "className",branch_id AS "branchId"`,
      [
        parent.tenantId,item.branch_id,item.id,parent.id,item.child_name,
        item.child_date_of_birth,item.current_grade,parent.name,
      ],
    );
    // Completing the parent-side enrolment does not approve admission. A
    // principal must approve the application before the app unlocks Home.
    await query("UPDATE applications SET status='PENDING_REVIEW',updated_at=now() WHERE id=$1", [item.id]);
    // Email is intentionally dispatched after persistence without blocking
    // the mobile response. A slow SMTP server must never trap the parent on
    // the confirmation form after their enrolment is already saved.
    void sendApplicationReceivedEmail({ to: parent.email, parentName: parent.name, childName: String(item.child_name) })
      .catch((error) => console.error("Enrollment confirmation email was not sent", error));
    res.status(200).json({
      ok: true,
      data: { ...student.rows[0], status: "PENDING_REVIEW", emailQueued: true },
    });
  },
);
