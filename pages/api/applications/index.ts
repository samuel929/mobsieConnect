import { apiHandler, one, pageLimit } from "@/server/api";
import { createApplicationAccessToken } from "@/server/applicationAccess";
import { getRequestUser, requireRole } from "@/server/auth";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { getOptionalParent } from "@/server/parentAuth";
import { applicationSchema } from "@/server/validation";

type CreatedApplication = {
  id: string;
  reference: string;
  status: string;
};

/**
 * Applications collection endpoint.
 *
 * GET  /api/applications       -> principal dashboard list
 * POST /api/applications       -> create an onboarding draft
 * GET  /api/applications/[id]  -> single application (separate route)
 */
export default apiHandler<unknown>(
  { methods: ["GET", "POST"], auth: false },
  async (req, res) => {
    if (req.method === "POST") {
      const tenantId = one(req.query.tenantId);
      if (!tenantId) {
        throw new AppError(
          400,
          "TENANT_REQUIRED",
          "A tenantId query parameter is required.",
        );
      }

      const tenant = await query<{ id: string }>(
        "SELECT id FROM tenants WHERE id = $1 LIMIT 1",
        [tenantId],
      );
      if (!tenant.rows[0]) {
        throw new AppError(404, "TENANT_NOT_FOUND", "School not found.");
      }

      const parent = await getOptionalParent(req);
      if (parent && parent.tenantId !== tenantId) {
        throw new AppError(403, "TENANT_MISMATCH", "This school is not available for your account.");
      }

      const input = applicationSchema.parse(req.body);
      const access = createApplicationAccessToken();
      const reference = `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const created = await query<CreatedApplication>(
        `INSERT INTO applications (
           tenant_id, reference, access_token_hash,
           parent_account_id,
           parent_name, parent_email, parent_phone, relationship,
           additional_guardian_name, additional_guardian_relationship, additional_guardian_email, additional_guardian_phone,
           child_name, child_id_number, child_date_of_birth, child_gender, current_grade,
           application_type, registration_fee_waived, child_has_disability, disability_details
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id, reference, status::text`,
        [
          tenantId,
          reference,
          access.hash,
          parent?.id ?? null,
          input.parentName,
          input.parentEmail,
          input.parentPhone,
          input.relationship,
          input.additionalGuardianEnabled ? input.additionalGuardianName || null : null,
          input.additionalGuardianEnabled ? input.additionalGuardianRelationship || null : null,
          input.additionalGuardianEnabled ? input.additionalGuardianEmail || null : null,
          input.additionalGuardianEnabled ? input.additionalGuardianPhone || null : null,
          input.childName,
          input.childIdNumber,
          input.childDateOfBirth,
          input.childGender,
          input.currentGrade,
          input.applicationType,
          input.applicationType === "REREGISTRATION",
          input.childHasDisability,
          input.disabilityDetails ?? null,
        ],
      );

      res.status(201).json({
        ok: true,
        data: {
          application: created.rows[0],
          accessToken: access.token,
        },
      });
      return;
    }

    const user = await getRequestUser(req);
    requireRole(user, ["PRINCIPAL"]);

    const status = one(req.query.status) ?? "";
    const search = (one(req.query.search) ?? "").trim();
    const result = await query<Record<string, unknown>>(
      `SELECT
         a.id,
         a.reference,
         a.parent_name AS "parentName",
         a.parent_email::text AS "parentEmail",
         a.parent_phone AS "parentPhone",
         a.relationship,
         a.additional_guardian_name AS "additionalGuardianName",
         a.additional_guardian_relationship AS "additionalGuardianRelationship",
         a.additional_guardian_email::text AS "additionalGuardianEmail",
         a.additional_guardian_phone AS "additionalGuardianPhone",
         a.child_name AS "childName",
         a.child_id_number AS "childIdNumber",
         a.child_date_of_birth::text AS "childDateOfBirth",
         a.child_gender AS "childGender",
         a.current_grade AS "currentGrade",
         a.application_type AS "applicationType",
         a.registration_fee_waived AS "registrationFeeWaived",
         a.child_has_disability AS "childHasDisability",
         a.disability_details AS "disabilityDetails",
         a.status::text,
         a.submitted_at::text AS "submittedAt",
         a.created_at::text AS "createdAt",
         a.waiting_list_email_sent_at::text AS "waitlistedAt",
         a.approval_email_sent_at::text AS "approvedAt",
         CASE WHEN a.parent_account_id IS NOT NULL AND EXISTS (
           SELECT 1
           FROM students sibling
           WHERE sibling.tenant_id = a.tenant_id
             AND sibling.parent_account_id = a.parent_account_id
             AND sibling.application_id IS DISTINCT FROM a.id
         ) THEN 'Sibling' ELSE 'Standard' END AS "waitingListPriority",
         b.id AS "branchId",
         b.name AS "branchName",
         COALESCE(d.document_count, 0)::int AS "documentCount",
         COALESCE(c.consent_signed_count, 0)::int AS "consentSignedCount",
         c.last_consent_signed_at::text AS "lastConsentSignedAt",
         CASE WHEN p.application_id IS NULL THEN NULL ELSE jsonb_build_object(
           'branchId', p.branch_id,
           'branchName', b.name,
           'reason', p.reason,
           'schoolType', p.school_type,
           'schoolStage', p.school_stage,
           'preferredStartDate', p.preferred_start_date,
           'enrollmentType', p.enrollment_type,
           'aftercareRequested', COALESCE((to_jsonb(p)->>'aftercare_requested')::boolean, false),
           'aftercareOption', to_jsonb(p)->>'aftercare_option',
           'transportRequested', COALESCE((to_jsonb(p)->>'transport_requested')::boolean, false),
           'transportRoute', to_jsonb(p)->>'transport_route',
           'previousSchool', p.previous_school,
           'previousSchoolPhone', p.previous_school_phone,
           'referralSource', p.referral_source,
           'attendedPreschool', p.attended_preschool,
           'allergies', p.allergies,
           'emergencyContactName', p.emergency_contact_name,
           'emergencyContactPhone', p.emergency_contact_phone,
           'feePayerFirstName', to_jsonb(p)->>'fee_payer_first_name',
           'feePayerLastName', to_jsonb(p)->>'fee_payer_last_name',
           'feePayerTermsAccepted', COALESCE((to_jsonb(p)->>'fee_payer_terms_accepted')::boolean, false)
         ) END AS preferences
       FROM applications a
       LEFT JOIN application_preferences p ON p.application_id = a.id
       LEFT JOIN branches b ON b.id = p.branch_id
       LEFT JOIN LATERAL (
         SELECT count(*) AS document_count
         FROM application_documents ad
         WHERE ad.application_id = a.id
       ) d ON true
       LEFT JOIN LATERAL (
         SELECT
           count(DISTINCT cfc.template_id) AS consent_signed_count,
           max(cfc.signed_at) AS last_consent_signed_at
         FROM students consent_student
         JOIN consent_form_completions cfc ON cfc.student_id = consent_student.id
         WHERE consent_student.application_id = a.id
           AND cfc.tenant_id = a.tenant_id
       ) c ON true
       WHERE a.tenant_id = $1
         AND ($2 = '' OR a.status::text = $2)
         AND (
           $3 = '' OR
           a.reference ILIKE '%' || $3 || '%' OR
           a.parent_name ILIKE '%' || $3 || '%' OR
           a.child_name ILIKE '%' || $3 || '%'
         )
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $4`,
      [user.tenantId, status, search, pageLimit(req.query.limit, 500)],
    );

    res.status(200).json({ ok: true, data: result.rows });
  },
);
