import { apiHandler, one } from "@/server/api";
import { getRequestUser, requireRole } from "@/server/auth";
import { requireApplicationAccess } from "@/server/applicationAccess";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { applicationSchema } from "@/server/validation";

type ApplicationLookup = {
  id: string;
  reference: string;
};

type ApplicationDetail = {
  id: string;
  reference: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  relationship: string;
  childName: string;
  childIdNumber: string;
  childDateOfBirth: string;
  childGender: string;
  currentGrade: string;
  status: string;
  registrationFeeWaived: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  preferences: Record<string, unknown> | null;
};

type ApplicationDocument = {
  id: string;
  kind: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  uploadedAt: string;
};

type ApplicationConsent = {
  informationAccurate: boolean;
  privacyAccepted: boolean;
  termsAccepted: boolean;
  enrolmentTermsAccepted: boolean;
  photoConsent: boolean;
  acceptedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

type ApplicationPayment = {
  id: string;
  provider: string;
  merchantPaymentId: string;
  amountCents: number;
  status: string;
  payfastPaymentId: string | null;
  paymentMethod: string | null;
  amountGrossCents: number | null;
  amountFeeCents: number | null;
  amountNetCents: number | null;
  payerFirstName: string | null;
  payerLastName: string | null;
  payerEmail: string | null;
  paidAt: string | null;
  createdAt: string;
};

type MobileEnrollment = {
  primaryCollector: string;
  secondaryCollector: string | null;
  confirmedAt: string;
  pickupPasswordConfigured: boolean;
};

type ConsentFormCompletion = {
  id: string;
  templateId: string;
  title: string;
  childName: string;
  guardianName: string;
  signedAt: string;
};

export default apiHandler<Record<string, unknown>>(
  {
    methods: ["GET", "PUT"],
    auth: false,
  },

  async (req, res) => {
    /**
     * Can be either:
     *
     * UUID:
     * 2bc7c408-...
     *
     * OR application reference:
     * S1-2026-92A51901
     */
    const identifier = one(req.query.id);

    if (!identifier) {
      throw new AppError(
        400,
        "APPLICATION_ID_REQUIRED",
        "Application ID is required.",
      );
    }

    /**
     * ------------------------------------------
     * Resolve reference OR UUID to database UUID
     * ------------------------------------------
     */
    const lookup = await query<ApplicationLookup>(
      `
        SELECT
          id,
          reference

        FROM applications

        WHERE
          id::text = $1
          OR reference = $1

        LIMIT 1
      `,
      [identifier],
    );

    const foundApplication = lookup.rows[0];

    if (!foundApplication) {
      throw new AppError(
        404,
        "APPLICATION_NOT_FOUND",
        "Application not found.",
      );
    }

    const applicationId = foundApplication.id;

    /**
     * ------------------------------------------
     * ACCESS
     * ------------------------------------------
     */
    if (req.method === "GET" && req.headers["x-application-token"]) {
      await requireApplicationAccess(req, applicationId);
    } else if (req.method === "PUT") {
      await requireApplicationAccess(req, applicationId);
    } else {
      const user = await getRequestUser(req);

      requireRole(user, ["PRINCIPAL"]);
    }

    /**
     * ------------------------------------------
     * UPDATE APPLICATION
     * ------------------------------------------
     */
    if (req.method === "PUT") {
      const input = applicationSchema.parse(req.body);

      const updateResult = await query<{
        id: string;
      }>(
        `
          UPDATE applications

          SET
            parent_name = $2,
            parent_email = $3,
            parent_phone = $4,
            relationship = $5,
            child_name = $6,
            child_id_number = $7,
            child_date_of_birth = $8,
            child_gender = $9,
            current_grade = $10,
            application_type = $11,
            registration_fee_waived = ($11 = 'REREGISTRATION'),
            child_has_disability = $12,
            disability_details = $13

          WHERE id = $1
            AND status = 'DRAFT'

          RETURNING id
        `,
        [
          applicationId,

          input.parentName,
          input.parentEmail,
          input.parentPhone,

          input.relationship,

          input.childName,
          input.childIdNumber,
          input.childDateOfBirth,
          input.childGender,

          input.currentGrade,
          input.applicationType,
          input.childHasDisability,
          input.disabilityDetails ?? null,
        ],
      );

      if (!updateResult.rows[0]) {
        throw new AppError(
          409,
          "APPLICATION_NOT_EDITABLE",
          "Only draft applications can be edited.",
        );
      }
    }

    /**
     * ------------------------------------------
     * LOAD APPLICATION
     * ------------------------------------------
     */
    const applicationResult = await query<ApplicationDetail>(
      `
          SELECT
            a.id,

            a.reference,

            a.parent_name
              AS "parentName",

            a.parent_email::text
              AS "parentEmail",

            a.parent_phone
              AS "parentPhone",

            a.relationship,

            a.child_name
              AS "childName",

            a.child_id_number
              AS "childIdNumber",

            a.child_date_of_birth::text
              AS "childDateOfBirth",

            a.child_gender
              AS "childGender",

            a.current_grade
              AS "currentGrade",

            a.application_type AS "applicationType",
            a.registration_fee_waived AS "registrationFeeWaived",
            a.child_has_disability AS "childHasDisability",
            COALESCE(a.disability_details, '') AS "disabilityDetails",

            a.status,
            a.submitted_at::text AS "submittedAt",
            a.created_at::text AS "createdAt",
            a.updated_at::text AS "updatedAt",

            CASE
              WHEN p.application_id IS NULL
              THEN NULL

              ELSE jsonb_build_object(
                'branchId',
                p.branch_id,

                'branchName',
                b.name,

                'reason',
                p.reason,

                'schoolType',
                p.school_type,

                'schoolStage',
                p.school_stage,

                'preferredStartDate',
                p.preferred_start_date,

                'enrollmentType',
                p.enrollment_type,
                'aftercareRequested',
                COALESCE((to_jsonb(p)->>'aftercare_requested')::boolean, false),

                'previousSchool',
                p.previous_school,

                'previousSchoolPhone',
                p.previous_school_phone,

                'referralSource',
                p.referral_source,

                'attendedPreschool',
                p.attended_preschool,

                'allergies',
                p.allergies,

                'emergencyContactName',
                p.emergency_contact_name,

                'emergencyContactPhone',
                p.emergency_contact_phone,

                'feePayerFirstName',
                to_jsonb(p)->>'fee_payer_first_name',

                'feePayerLastName',
                to_jsonb(p)->>'fee_payer_last_name',

                'feePayerTermsAccepted',
                COALESCE((to_jsonb(p)->>'fee_payer_terms_accepted')::boolean, false)
              )
            END AS preferences

          FROM applications a

          LEFT JOIN application_preferences p
            ON p.application_id = a.id

          LEFT JOIN branches b
            ON b.id = p.branch_id

          WHERE a.id = $1

          LIMIT 1
        `,
      [applicationId],
    );

    const application = applicationResult.rows[0];

    if (!application) {
      throw new AppError(
        404,
        "APPLICATION_NOT_FOUND",
        "Application not found.",
      );
    }

    /**
     * ------------------------------------------
     * LOAD ALL DOCUMENTS
     * ------------------------------------------
     *
     * IMPORTANT:
     *
     * Only selecting columns that exist in
     * your current application_documents table.
     */
    const documentsResult = await query<ApplicationDocument>(
      `
          SELECT
            d.id,

            d.kind,

            d.file_url
              AS "fileUrl",

            d.original_name
              AS "originalName",

            d.mime_type AS "mimeType",
            d.bytes,
            d.review_status AS "reviewStatus",
            d.uploaded_at::text AS "uploadedAt"

          FROM application_documents d

          WHERE d.application_id = $1

          ORDER BY d.id ASC
        `,
      [applicationId],
    );

    const submissionConsentsResult = await query<ApplicationConsent>(
      `SELECT
         information_accurate AS "informationAccurate",
         privacy_accepted AS "privacyAccepted",
         terms_accepted AS "termsAccepted",
         enrolment_terms_accepted AS "enrolmentTermsAccepted",
         photo_consent AS "photoConsent",
         accepted_at::text AS "acceptedAt",
         host(ip_address) AS "ipAddress",
         user_agent AS "userAgent"
       FROM application_consents
       WHERE application_id = $1
       LIMIT 1`,
      [applicationId],
    );

    const paymentResult = await query<ApplicationPayment>(
      `SELECT
         id,
         provider,
         merchant_payment_id AS "merchantPaymentId",
         amount_cents AS "amountCents",
         status,
         pf_payment_id AS "payfastPaymentId",
         payment_method AS "paymentMethod",
         amount_gross_cents AS "amountGrossCents",
         amount_fee_cents AS "amountFeeCents",
         amount_net_cents AS "amountNetCents",
         payer_first_name AS "payerFirstName",
         payer_last_name AS "payerLastName",
         payer_email::text AS "payerEmail",
         paid_at::text AS "paidAt",
         created_at::text AS "createdAt"
       FROM application_payments
       WHERE application_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId],
    );

    const enrollmentResult = await query<MobileEnrollment>(
      `SELECT
         primary_collector AS "primaryCollector",
         secondary_collector AS "secondaryCollector",
         confirmed_at::text AS "confirmedAt",
         true AS "pickupPasswordConfigured"
       FROM mobile_enrollments
       WHERE application_id = $1
       LIMIT 1`,
      [applicationId],
    );

    const consentFormsResult = await query<ConsentFormCompletion>(
      `SELECT
         cfc.id,
         cfc.template_id AS "templateId",
         cfc.title,
         cfc.child_name AS "childName",
         cfc.guardian_name AS "guardianName",
         cfc.signed_at::text AS "signedAt"
       FROM consent_form_completions cfc
       JOIN students consent_student ON consent_student.id = cfc.student_id
       WHERE consent_student.application_id = $1
         AND cfc.tenant_id = (SELECT tenant_id FROM applications WHERE id = $1)
       ORDER BY cfc.signed_at DESC, cfc.title ASC`,
      [applicationId],
    );

    /**
     * ------------------------------------------
     * RESPONSE
     * ------------------------------------------
     */
    res.status(200).json({
      ok: true,

      data: {
        ...application,

        documents: documentsResult.rows,

        documentCount: documentsResult.rows.length,

        consentForms: consentFormsResult.rows,

        consentSignedCount: new Set(consentFormsResult.rows.map((form) => form.templateId)).size,

        consentFormsComplete:
          new Set(consentFormsResult.rows.map((form) => form.templateId)).size >= 5,

        submissionConsents: submissionConsentsResult.rows[0] ?? null,

        payment: paymentResult.rows[0] ?? null,

        enrollment: enrollmentResult.rows[0] ?? null,
      },
    });
  },
);
