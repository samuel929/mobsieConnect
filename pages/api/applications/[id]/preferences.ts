import { apiHandler, one } from "@/server/api";
import { requireApplicationAccess } from "@/server/applicationAccess";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { preferencesSchema } from "@/server/validation";

const branchReferencePrefix = (branchName: string) => {
  const value = branchName.toLowerCase();
  if (value.includes("soshanguve")) return "S1";
  if (value.includes("mamelodi")) return "M1";
  if (value.includes("thembisa") || value.includes("tembisa")) return "T1";
  if (value.includes("sky")) return "SC1";
  if (value.includes("hebron")) return "H1";
  if (value.includes("soweto")) return "S2";
  // New branches remain usable before a reference code is configured.
  return branchName.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "APP";
};

export default apiHandler<{ saved: true; reference: string }>(
  { methods: ["PUT"], auth: false },
  async (req, res) => {
    const applicationId = one(req.query.id);
    if (!applicationId) throw new AppError(400, "APPLICATION_ID_REQUIRED", "Application ID is required.");
    await requireApplicationAccess(req, applicationId);
    const body = req.body && typeof req.body === "object" ? req.body : {};
    // Accept the camelCase contract used by Expo and the snake_case aliases
    // used by older dashboard forms. This prevents a silent contract mismatch
    // from becoming an unhelpful 422 response.
    const input = preferencesSchema.parse({
      ...body,
      branchId: body.branchId ?? body.branch_id,
      schoolType: body.schoolType ?? body.school_type,
      schoolStage: body.schoolStage ?? body.school_stage,
      preferredStartDate: body.preferredStartDate ?? body.preferred_start_date,
      enrollmentType: body.enrollmentType ?? body.enrollment_type,
      aftercareRequested: body.aftercareRequested ?? body.aftercare_requested ?? false,
      previousSchool: body.previousSchool ?? body.previous_school,
      previousSchoolPhone: body.previousSchoolPhone ?? body.previous_school_phone,
      referralSource: body.referralSource ?? body.referral_source,
      attendedPreschool: body.attendedPreschool ?? body.attended_preschool,
      emergencyContactName: body.emergencyContactName ?? body.emergency_contact_name,
      emergencyContactPhone: body.emergencyContactPhone ?? body.emergency_contact_phone,
      feePayerFirstName: body.feePayerFirstName ?? body.fee_payer_first_name,
      feePayerLastName: body.feePayerLastName ?? body.fee_payer_last_name,
      feePayerTermsAccepted:
        body.feePayerTermsAccepted ?? body.fee_payer_terms_accepted ?? false,
    });
    // Validate the selected campus before writing preferences. This gives the
    // mobile form a useful 422 instead of a database foreign-key failure.
    const branch = await query<{ name: string }>(
      `SELECT name FROM branches b
       JOIN applications a ON a.tenant_id=b.tenant_id
       WHERE b.id=$1 AND a.id=$2 LIMIT 1`,
      [input.branchId, applicationId],
    );
    if (!branch.rows[0]) throw new AppError(422, "BRANCH_NOT_FOUND", "Selected branch was not found.");
    await query(
      `INSERT INTO application_preferences (
        application_id, branch_id, reason, school_type, school_stage, preferred_start_date, enrollment_type,
        previous_school, previous_school_phone, referral_source, attended_preschool, allergies, emergency_contact_name,
        emergency_contact_phone, fee_payer_first_name, fee_payer_last_name, fee_payer_terms_accepted,
        aftercare_requested
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (application_id) DO UPDATE SET
        branch_id = EXCLUDED.branch_id, reason = EXCLUDED.reason,
        school_type = EXCLUDED.school_type, school_stage = EXCLUDED.school_stage,
        preferred_start_date = EXCLUDED.preferred_start_date,
        enrollment_type = EXCLUDED.enrollment_type,
        aftercare_requested = EXCLUDED.aftercare_requested,
        previous_school = EXCLUDED.previous_school,
        previous_school_phone = EXCLUDED.previous_school_phone,
        referral_source = EXCLUDED.referral_source,
        attended_preschool = EXCLUDED.attended_preschool,
        allergies = EXCLUDED.allergies,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
        fee_payer_first_name = EXCLUDED.fee_payer_first_name,
        fee_payer_last_name = EXCLUDED.fee_payer_last_name,
        fee_payer_terms_accepted = EXCLUDED.fee_payer_terms_accepted,
        updated_at = now()`,
      [
        applicationId,
        input.branchId,
        input.reason ?? null,
        input.schoolType,
        input.schoolStage,
        input.preferredStartDate,
        input.enrollmentType,
        input.previousSchool ?? null,
        input.previousSchoolPhone,
        input.referralSource,
        input.attendedPreschool,
        input.allergies ?? null,
        input.emergencyContactName,
        input.emergencyContactPhone,
        input.feePayerFirstName ?? "",
        input.feePayerLastName ?? "",
        input.feePayerTermsAccepted,
        input.enrollmentType === "FULL_TIME" && input.aftercareRequested,
      ],
    );
    const prefix = branchReferencePrefix(branch.rows[0].name);
    const reference = `${prefix}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const updated = await query<{ reference: string }>(
      `UPDATE applications SET reference=$2, updated_at=now()
       WHERE id=$1 AND status='DRAFT' RETURNING reference`,
      [applicationId, reference],
    );
    res.status(200).json({ ok: true, data: { saved: true, reference: updated.rows[0]?.reference ?? reference } });
  },
);
