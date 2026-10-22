import { z } from "zod";
import type { NextApiResponse } from "next";

import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

const reviewSchema = z.object({ reviewStatus: z.enum(["APPROVED", "REJECTED"]) });

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

export default apiHandler<{ id: string; reviewStatus: string }>(
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
