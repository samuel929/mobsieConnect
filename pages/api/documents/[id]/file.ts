import type { NextApiResponse } from "next";

import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

type DocumentFile = {
  name: string;
  fileUrl: string;
  mimeType: string;
};

function safeFilename(value: string) {
  return value.replace(/[\\/\r\n"]/g, "_").trim() || "document";
}

export default apiHandler<unknown>(
  { methods: ["GET"], roles: ["PRINCIPAL"] },
  async (req, res: NextApiResponse, { user }) => {
    const id = one(req.query.id);
    if (!id) throw new AppError(400, "DOCUMENT_ID_REQUIRED", "Document ID is required.");
    const result = await query<DocumentFile>(
      `SELECT name,file_url AS "fileUrl",mime_type AS "mimeType"
       FROM dashboard_documents
       WHERE id=$1 AND tenant_id=$2
       LIMIT 1`,
      [id, user!.tenantId],
    );
    const document = result.rows[0];
    if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found.");

    const upstream = await fetch(document.fileUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: document.mimeType },
    });
    if (!upstream.ok) {
      throw new AppError(502, "DOCUMENT_UNAVAILABLE", "The stored document could not be retrieved.");
    }
    const file = Buffer.from(await upstream.arrayBuffer());
    if (!file.length) throw new AppError(502, "DOCUMENT_EMPTY", "The stored document is empty.");
    if (document.mimeType === "application/pdf" && file.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new AppError(502, "INVALID_PDF", "The stored file is not a valid PDF. Please upload it again.");
    }

    const filename = safeFilename(document.name);
    const disposition = one(req.query.disposition) === "attachment" ? "attachment" : "inline";
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Length", String(file.length));
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(200).send(file);
  },
);
