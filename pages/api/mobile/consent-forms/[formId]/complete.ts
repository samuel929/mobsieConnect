import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { getParent } from "@/server/parentAuth";
import { consentCompletionSchema } from "@/server/validation";

const titles: Record<string, string> = {
  "excursion-consent": "Excursion Consent",
  "photography-consent": "Photography Consent",
  "medical-consent": "Medical Consent",
  "transport-consent": "Transport Consent",
  "general-consent": "General Consent",
};

export default apiHandler<{ id: string; signedAt: string }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    const templateId = one(req.query.formId);
    const title = templateId ? titles[templateId] : undefined;
    if (!templateId || !title) throw new AppError(404, "FORM_NOT_FOUND", "This consent form is not available.");
    const input = consentCompletionSchema.parse(req.body);

    if (!input.studentId) throw new AppError(403, "ENROLMENT_REQUIRED", "Your child must be enrolled before completing forms.");
    const learner = await query<{ id: string }>(
      `SELECT s.id FROM students s
       JOIN applications a ON a.id=s.application_id
       WHERE s.id=$1 AND s.tenant_id=$2
         AND a.parent_account_id=$3
         AND upper(trim(a.reference))=upper(trim($4))
         AND lower(trim(s.name))=lower(trim($5))
         AND upper(s.enrollment_status) IN ('ENROLLED','ACTIVE')`,
      [input.studentId, parent.tenantId, parent.id, input.applicationReference, input.childName],
    );
    const verifiedStudentId = learner.rows[0]?.id;
    if (!verifiedStudentId) {
      throw new AppError(403, "FORM_IDENTITY_MISMATCH", "The child name or application reference does not match an enrolled child on your account.");
    }

    const fallbackHtml = `<article><h1>${title}</h1><p>Completed by ${input.guardianName} for ${input.childName}.</p><p>Signature: ${input.signature}</p></article>`;
    const saved = await query<{ id: string; signedAt: string }>(
      `INSERT INTO consent_form_completions (
         tenant_id,parent_account_id,student_id,template_id,title,child_name,guardian_name,guardian_id,signature,document_html,signed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz,now()))
       ON CONFLICT (parent_account_id,student_id,template_id) DO UPDATE SET
         child_name=EXCLUDED.child_name, guardian_name=EXCLUDED.guardian_name,
         guardian_id=EXCLUDED.guardian_id, signature=EXCLUDED.signature,
         document_html=EXCLUDED.document_html, signed_at=EXCLUDED.signed_at
       RETURNING id, signed_at::text AS "signedAt"`,
      [parent.tenantId, parent.id, verifiedStudentId, templateId, title, input.childName,
        input.guardianName, input.guardianId, input.signature, input.documentHtml ?? fallbackHtml,
        input.signedAt ?? null],
    );
    res.status(200).json({ ok: true, data: saved.rows[0] });
  },
);
