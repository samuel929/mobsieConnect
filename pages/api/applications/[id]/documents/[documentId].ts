import { z } from "zod";
import type { NextApiResponse } from "next";

import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { createAndSendNotification } from "@/server/expoPush";

const reviewSchema = z
  .object({
    reviewStatus: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.reviewStatus === "REJECTED" && (!value.reason || value.reason.length < 5)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Explain what is wrong so the parent knows which document to upload.",
      });
    }
  });

type DocumentContext = {
  id: string;
  kind: string;
  parentAccountId: string | null;
  branchId: string | null;
};

type StoredDocument = {
  id: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
};

function downloadName(originalName: string, mimeType: string) {
  const cleaned = String(originalName || "document")
    .split(/[\\/]/)
    .pop()!
    .replace(/[^A-Za-z0-9._ -]/g, "-")
    .trim();
  if (mimeType === "application/pdf") {
    const stem = cleaned.replace(/\.[^.]+$/, "") || "document";
    return `${stem}.pdf`;
  }
  return cleaned || "document";
}

export default apiHandler<{ id: string; reviewStatus: string; rejectionReason?: string | null }>(
  { methods: ["GET", "PUT"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const applicationId = one(req.query.id);
    const documentId = one(req.query.documentId);
    if (!applicationId || !documentId) {
      throw new AppError(400, "DOCUMENT_REQUIRED", "Application and document IDs are required.");
    }
    if (req.method === "GET") {
      const stored = await query<StoredDocument>(
        `SELECT d.id, d.file_url AS "fileUrl", d.original_name AS "originalName",
                d.mime_type AS "mimeType"
         FROM application_documents d
         JOIN applications a ON a.id=d.application_id
         WHERE d.id=$1
           AND a.tenant_id=$2
           AND (a.id::text=$3 OR a.reference=$3)
         LIMIT 1`,
        [documentId, user!.tenantId, applicationId],
      );
      const document = stored.rows[0];
      if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found.");

      const source = await fetch(document.fileUrl);
      if (!source.ok) {
        throw new AppError(502, "DOCUMENT_FETCH_FAILED", "The document could not be opened.");
      }
      const buffer = Buffer.from(await source.arrayBuffer());
      const disposition = one(req.query.disposition) === "attachment" ? "attachment" : "inline";
      res.setHeader("Content-Type", document.mimeType || source.headers.get("content-type") || "application/octet-stream");
      res.setHeader("Content-Disposition", `${disposition}; filename="${downloadName(document.originalName, document.mimeType)}"`);
      res.setHeader("Content-Length", String(buffer.length));
      (res as NextApiResponse).status(200).end(buffer);
      return;
    }
    const input = reviewSchema.parse(req.body);
    const context = await query<DocumentContext>(
      `SELECT d.id, d.kind::text AS kind,
              a.parent_account_id AS "parentAccountId", p.branch_id AS "branchId"
       FROM application_documents d
       JOIN applications a ON a.id=d.application_id
       LEFT JOIN application_preferences p ON p.application_id=a.id
       WHERE d.id=$1 AND a.tenant_id=$2
         AND (a.id::text=$3 OR a.reference=$3)
       LIMIT 1`,
      [documentId, user!.tenantId, applicationId],
    );
    const documentContext = context.rows[0];
    if (!documentContext) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found.");

    const reviewed = await query<{ id: string; reviewStatus: string }>(
      `UPDATE application_documents d
       SET review_status=$4, reviewed_at=now(), reviewed_by=$3,
           rejection_reason=CASE WHEN $4='REJECTED' THEN $6 ELSE NULL END,
           reupload_requested_at=CASE WHEN $4='REJECTED' THEN now() ELSE NULL END
       FROM applications a
       WHERE d.id=$1
         AND a.id=d.application_id
         AND a.tenant_id=$5
         AND (a.id::text=$2 OR a.reference=$2)
       RETURNING d.id,d.review_status AS "reviewStatus"`,
      [documentId, applicationId, user!.id, input.reviewStatus, user!.tenantId, input.reason ?? null],
    );
    if (!reviewed.rows[0]) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found.");

    if (input.reviewStatus === "REJECTED") {
      await query(
        `UPDATE applications
         SET status='DOCUMENTS_REQUIRED', updated_at=now()
         WHERE id=(SELECT application_id FROM application_documents WHERE id=$1)
           AND status IN ('PENDING_REVIEW','DOCUMENTS_REQUIRED')`,
        [documentId],
      );

      if (documentContext.parentAccountId) {
        const documentName = documentContext.kind.toLowerCase().replace(/_/g, " ");
        try {
          await createAndSendNotification({
            tenantId: user!.tenantId,
            branchId: documentContext.branchId,
            parentAccountId: documentContext.parentAccountId,
            title: "Document needs to be replaced",
            body: `Your ${documentName} was not accepted: ${input.reason}. Upload the correct document to continue.`,
            audience: "Parent",
            data: {
              screen: "ApplicationReview",
              applicationId,
              documentId,
              documentKind: documentContext.kind,
              action: "REUPLOAD_DOCUMENT",
            },
            sourceType: "APPLICATION_DOCUMENT_REUPLOAD",
            sourceId: `${documentId}:${Date.now()}`,
          });
        } catch (error) {
          console.error("Could not send document re-upload notification", error);
        }
      }
    }

    res.status(200).json({
      ok: true,
      data: { ...reviewed.rows[0], rejectionReason: input.reviewStatus === "REJECTED" ? input.reason : null },
    });
  },
);
