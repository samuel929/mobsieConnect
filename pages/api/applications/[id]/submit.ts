import { apiHandler, one } from "@/server/api";
import { requireApplicationAccess } from "@/server/applicationAccess";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { consentSchema } from "@/server/validation";

/**
 * PostgreSQL normally returns ARRAY(...) as a JavaScript array. Some drivers
 * (or enum-array parsers) return a Postgres array string instead, so never
 * call array methods directly on the raw database value.
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || value === "{}") return [];

  return value
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

export default apiHandler<{ reference: string; status: string }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const applicationId = one(req.query.id);
    if (!applicationId) throw new AppError(400, "APPLICATION_ID_REQUIRED", "Application ID is required.");
    await requireApplicationAccess(req, applicationId);
    const input = consentSchema.parse(req.body);
    const readiness = await query<{
      hasPreferences: boolean;
      feePayerReady: boolean;
      paymentComplete: boolean;
      missingDocuments: string[];
    }>(
      `SELECT
         EXISTS(SELECT 1 FROM application_preferences WHERE application_id = $1) AS "hasPreferences",
         EXISTS(
           SELECT 1
           FROM application_preferences
           WHERE application_id = $1
             AND length(trim(coalesce(fee_payer_first_name, ''))) >= 2
             AND length(trim(coalesce(fee_payer_last_name, ''))) >= 2
             AND coalesce(fee_payer_terms_accepted, false) = true
         ) AS "feePayerReady",
         (
           EXISTS(SELECT 1 FROM applications a WHERE a.id=$1 AND a.application_type='REREGISTRATION')
           OR EXISTS(SELECT 1 FROM application_payments p WHERE p.application_id=$1 AND p.status='COMPLETE')
         ) AS "paymentComplete",
         ARRAY(
           SELECT required.kind
           FROM unnest(ARRAY[
             'LEARNER_PHOTO'::document_kind,
             'BIRTH_CERTIFICATE'::document_kind,
             'PARENT_ID'::document_kind,
             'CLINIC_CARD'::document_kind,
             'PROOF_OF_ADDRESS'::document_kind,
             'PROOF_OF_INCOME'::document_kind
           ]) AS required(kind)
           WHERE NOT EXISTS(
             SELECT 1 FROM application_documents d
             WHERE d.application_id = $1 AND d.kind = required.kind
           )
         ) AS "missingDocuments"`,
      [applicationId],
    );
    const applicationReadiness = readiness.rows[0];
    if (!applicationReadiness?.hasPreferences) {
      throw new AppError(422, "PREFERENCES_REQUIRED", "Complete school preferences before submitting.");
    }
    if (!applicationReadiness.feePayerReady) {
      throw new AppError(
        422,
        "FEE_PAYER_DETAILS_REQUIRED",
        "Add the fee payer's name and accept the fee-payer consent before submitting.",
      );
    }
    if (!applicationReadiness.paymentComplete) {
      throw new AppError(422, "PAYMENT_REQUIRED", "Complete the PayFast application-fee payment before submitting.");
    }
    const missingDocuments = toStringArray(applicationReadiness.missingDocuments);
    if (missingDocuments.length) {
      throw new AppError(
        422,
        "DOCUMENTS_REQUIRED",
        `Upload all required documents before submitting. Missing: ${missingDocuments.join(", ")}.`,
      );
    }
    const result = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO application_consents (
           application_id, information_accurate, privacy_accepted, terms_accepted, enrolment_terms_accepted,
           accepted_at, ip_address, user_agent
         ) VALUES ($1,$2,$3,$4,$5,now(),$6,$7)
         ON CONFLICT (application_id) DO UPDATE SET
           information_accurate = EXCLUDED.information_accurate,
           privacy_accepted = EXCLUDED.privacy_accepted,
           terms_accepted = EXCLUDED.terms_accepted, accepted_at = now(),
           enrolment_terms_accepted = EXCLUDED.enrolment_terms_accepted,
           ip_address = EXCLUDED.ip_address, user_agent = EXCLUDED.user_agent`,
        [
          applicationId,
          input.informationAccurate,
          input.privacyAccepted,
          input.termsAccepted,
          input.enrolmentTermsAccepted,
          req.socket.remoteAddress ?? null,
          req.headers["user-agent"] ?? null,
        ],
      );
      return client.query<{ reference: string; status: string }>(
        `UPDATE applications SET status = 'PENDING_REVIEW', submitted_at = now()
         WHERE id = $1
         RETURNING reference, status::text`,
        [applicationId],
      );
    });
    res.status(200).json({ ok: true, data: result.rows[0] });
  },
);
