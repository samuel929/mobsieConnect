import { z } from "zod";

import { apiHandler, pageLimit } from "@/server/api";
import { query } from "@/server/db";

const createSchema = z.object({
  name: z.string().trim().min(1).max(180),
  folder: z.string().trim().min(1).max(80),
  sharedWith: z.string().trim().min(1).max(120),
  fileUrl: z.string().url().max(2000),
  publicId: z.string().trim().min(1).max(500),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  bytes: z.number().int().positive().max(8 * 1024 * 1024),
  branchId: z.uuid().nullable().optional(),
});

type DocumentRow = {
  id: string;
  name: string;
  folder: string;
  sharedWith: string;
  fileUrl: string;
  publicId: string;
  mimeType: string;
  bytes: string;
  ownerName: string;
  branchId: string | null;
  branchName: string | null;
  createdAt: string;
};

const select = `SELECT d.id,d.name,d.folder,d.shared_with AS "sharedWith",
  d.file_url AS "fileUrl",d.public_id AS "publicId",d.mime_type AS "mimeType",
  d.bytes::text,b.id AS "branchId",b.name AS "branchName",
  COALESCE(u.name,u.email,'Unknown') AS "ownerName",d.created_at::text AS "createdAt"
  FROM dashboard_documents d
  LEFT JOIN branches b ON b.id=d.branch_id
  LEFT JOIN users u ON u.id=d.created_by`;

export default apiHandler<DocumentRow[]>({ methods: ["GET", "POST"], roles: ["PRINCIPAL"] }, async (req, res, { user }) => {
  const principal = user!;
  if (req.method === "POST") {
    const input = createSchema.parse(req.body);
    const inserted = await query<{ id: string }>(`INSERT INTO dashboard_documents
      (tenant_id,branch_id,name,folder,shared_with,file_url,public_id,mime_type,bytes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [principal.tenantId,input.branchId??null,input.name,input.folder,input.sharedWith,input.fileUrl,input.publicId,input.mimeType,input.bytes,principal.id]);
    const row = await query<DocumentRow>(`${select} WHERE d.tenant_id=$1 AND d.id=$2`, [principal.tenantId,inserted.rows[0].id]);
    res.status(201).json({ ok: true, data: row.rows });
    return;
  }
  const result = await query<DocumentRow>(`${select} WHERE d.tenant_id=$1 ORDER BY d.created_at DESC LIMIT $2`, [principal.tenantId,pageLimit(req.query.limit,500)]);
  res.status(200).json({ ok: true, data: result.rows });
});
