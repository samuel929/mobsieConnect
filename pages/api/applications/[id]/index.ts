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
  childDateOfBirth: string;
  childGender: string;
  currentGrade: string;
  status: string;
  preferences: Record<string, unknown> | null;
};

type ApplicationDocument = {
  id: string;
  kind: string;
  fileUrl: string;
  originalName: string;
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
    if (
      req.method === "GET" &&
      req.headers["x-application-token"]
    ) {
      await requireApplicationAccess(
        req,
        applicationId,
      );
    } else if (req.method === "PUT") {
      await requireApplicationAccess(
        req,
        applicationId,
      );
    } else {
      const user =
        await getRequestUser(req);

      requireRole(user, ["PRINCIPAL"]);
    }

    /**
     * ------------------------------------------
     * UPDATE APPLICATION
     * ------------------------------------------
     */
    if (req.method === "PUT") {
      const input =
        applicationSchema.parse(req.body);

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
            child_date_of_birth = $7,
            child_gender = $8,
            current_grade = $9,
            application_type = $10,
            registration_fee_waived = ($10 = 'REREGISTRATION'),
            child_has_disability = $11,
            disability_details = $12

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
    const applicationResult =
      await query<ApplicationDetail>(
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

            a.child_date_of_birth::text
              AS "childDateOfBirth",

            a.child_gender
              AS "childGender",

            a.current_grade
              AS "currentGrade",

            a.application_type AS "applicationType",
            a.child_has_disability AS "childHasDisability",
            COALESCE(a.disability_details, '') AS "disabilityDetails",

            a.status,

            CASE
              WHEN p.application_id IS NULL
              THEN NULL

              ELSE jsonb_build_object(
                'branchId',
                p.branch_id,

                'branchName',
                b.name,

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
                p.emergency_contact_phone
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

    const application =
      applicationResult.rows[0];

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
    const documentsResult =
      await query<ApplicationDocument>(
        `
          SELECT
            d.id,

            d.kind,

            d.file_url
              AS "fileUrl",

            d.original_name
              AS "originalName"

          FROM application_documents d

          WHERE d.application_id = $1

          ORDER BY d.id ASC
        `,
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

        documents:
          documentsResult.rows,

        documentCount:
          documentsResult.rows.length,
      },
    });
  },
);
