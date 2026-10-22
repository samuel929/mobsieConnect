import { z } from "zod";

import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

const reviewSchema = z.object({ reviewStatus: z.enum(["APPROVED", "REJECTED"]) });

export default apiHandler<{ id: string; reviewStatus: string }>(
  { methods: ["PUT"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const applicationId = one(req.query.id);
    const documentId = one(req.query.documentId);
    if (!applicationId || !documentId) {
      throw new AppError(400, "DOCUMENT_REQUIRED", "Application and document IDs are required.");
    }
    const input = reviewSchema.parse(req.body);
    const reviewed = await query<{ id: string; reviewStatus: string }>(
      `UPDATE application_documents d
       SET review_status=$4, reviewed_at=now(), reviewed_by=$3
       FROM applications a
       WHERE d.id=$1
         AND a.id=d.application_id
         AND a.tenant_id=$5
         AND (a.id::text=$2 OR a.reference=$2)
       RETURNING d.id,d.review_status AS "reviewStatus"`,
      [documentId, applicationId, user!.id, input.reviewStatus, user!.tenantId],
    );
    if (!reviewed.rows[0]) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
    res.status(200).json({ ok: true, data: reviewed.rows[0] });
  },
);
