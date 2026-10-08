import { apiHandler, one } from "@/server/api";
import { requireApplicationAccess } from "@/server/applicationAccess";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { approximateDataUriBytes, uploadDataUri } from "@/server/uploads";
import { documentSchema } from "@/server/validation";

export const config = { api: { bodyParser: { sizeLimit: "14mb" } } };

export default apiHandler<{ id: string; kind: string; fileUrl: string }>(
  { methods: ["POST"], auth: false },
  async (req, res) => {
    const applicationId = one(req.query.id);
    if (!applicationId) throw new AppError(400, "APPLICATION_ID_REQUIRED", "Application ID is required.");
    await requireApplicationAccess(req, applicationId);
    const input = documentSchema.parse(req.body);
    const bytes = approximateDataUriBytes(input.fileData);
    if (bytes > 8 * 1024 * 1024) {
      throw new AppError(413, "FILE_TOO_LARGE", "Documents must be smaller than 8 MB.");
    }
    const uploaded = await uploadDataUri(
      input.fileData,
      `applications/${applicationId}`,
      input.mimeType === "application/pdf" ? "raw" : "image",
    );
    const result = await query<{ id: string; kind: string; fileUrl: string }>(
      `INSERT INTO application_documents (
        application_id, kind, file_url, public_id, original_name, mime_type, bytes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (application_id, kind) DO UPDATE SET
        file_url = EXCLUDED.file_url, public_id = EXCLUDED.public_id,
        original_name = EXCLUDED.original_name, mime_type = EXCLUDED.mime_type,
        bytes = EXCLUDED.bytes, uploaded_at = now()
      RETURNING id, kind::text, file_url AS "fileUrl"`,
      [
        applicationId,
        input.kind,
        uploaded.url,
        uploaded.publicId,
        input.originalName,
        input.mimeType,
        uploaded.bytes || bytes,
      ],
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  },
);
