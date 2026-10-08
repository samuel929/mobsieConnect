import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { getParent } from "@/server/parentAuth";

type FormRow = {
  id: string;
  templateId: string;
  title: string;
  completed: boolean;
  signedAt: string | null;
  studentId: string | null;
  documentHtml: string | null;
};

const templates = [
  { id: "excursion-consent", title: "Excursion Consent", description: "Permission for supervised school outings and excursions." },
  { id: "photography-consent", title: "Photography Consent", description: "Permission to use learner photos for school communications." },
  { id: "medical-consent", title: "Medical Consent", description: "Permission for emergency medical care when a guardian cannot be reached." },
  { id: "transport-consent", title: "Transport Consent", description: "Permission for approved school transport where applicable." },
  { id: "general-consent", title: "General Consent", description: "General school conduct, collection and communication consent." },
];

export default apiHandler<FormRow[]>(
  { methods: ["GET"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    const completed = await query<{
      id: string; templateId: string; title: string; signedAt: string; studentId: string | null; documentHtml: string | null;
    }>(
      `SELECT id, template_id AS "templateId", title, signed_at::text AS "signedAt", student_id AS "studentId", document_html AS "documentHtml"
       FROM consent_form_completions
       WHERE tenant_id=$1 AND parent_account_id=$2
       ORDER BY signed_at DESC`,
      [parent.tenantId, parent.id],
    );
    const latestByTemplate = new Map(completed.rows.map((row) => [row.templateId, row]));
    const data = templates.map((template) => {
      const row = latestByTemplate.get(template.id);
      return {
        id: row?.id ?? template.id,
        templateId: template.id,
        title: template.title,
        completed: Boolean(row),
        signedAt: row?.signedAt ?? null,
        studentId: row?.studentId ?? null,
        description: template.description,
        documentHtml: row?.documentHtml ?? null,
      };
    });
    res.status(200).json({ ok: true, data });
  },
);
