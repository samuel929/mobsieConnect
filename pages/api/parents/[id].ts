import { apiHandler, one } from "@/server/api";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { adminParentSchema } from "@/server/validation";
import { cloudinaryClient } from "@/server/cloudinary";

type ParentRow = Record<string, unknown>;

function parentId(value: string | string[] | undefined) {
  const id = one(value);
  if (!id) throw new AppError(400, "INVALID_PARENT_ID", "A parent id is required.");
  return id;
}

export default apiHandler<ParentRow[]>(
  { methods: ["PUT", "DELETE"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const id = parentId(req.query.id);

    if (req.method === "DELETE") {
      const removed = await withTransaction(async (client) => {
        const parent = await client.query<{ id: string }>(
          `SELECT id FROM parent_accounts WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
          [id, user!.tenantId],
        );
        if (!parent.rows[0]) throw new AppError(404, "PARENT_NOT_FOUND", "Parent not found.");

        const assets = await client.query<{
          publicId: string;
          mimeType: string;
        }>(
          `SELECT d.public_id AS "publicId",d.mime_type AS "mimeType"
           FROM application_documents d
           JOIN applications a ON a.id=d.application_id
           WHERE a.parent_account_id=$1 AND a.tenant_id=$2`,
          [id, user!.tenantId],
        );
        const counts = await client.query<{
          children: number;
          applications: number;
        }>(
          `SELECT
             (SELECT count(*)::int FROM students WHERE parent_account_id=$1 AND tenant_id=$2) AS children,
             (SELECT count(*)::int FROM applications WHERE parent_account_id=$1 AND tenant_id=$2) AS applications`,
          [id, user!.tenantId],
        );

        // Rows that deliberately use ON DELETE SET NULL are explicitly removed
        // here so no mobile-app history remains attached to the deleted family.
        await client.query(
          `DELETE FROM shop_orders WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM deregistration_requests WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM students WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM applications WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM parent_accounts WHERE id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `INSERT INTO audit_log (tenant_id,actor_id,action,entity_type,metadata)
           VALUES ($1,$2,'Permanently deleted mobile parent account','parent_account',$3::jsonb)`,
          [
            user!.tenantId,
            user!.id,
            JSON.stringify({
              removedParentId: id,
              removedChildren: counts.rows[0]?.children ?? 0,
              removedApplications: counts.rows[0]?.applications ?? 0,
            }),
          ],
        );
        return {
          id,
          children: counts.rows[0]?.children ?? 0,
          applications: counts.rows[0]?.applications ?? 0,
          assets: assets.rows,
        };
      });

      // Database deletion is authoritative. Clean Cloudinary assets afterwards
      // so a temporary provider outage cannot restore app access or records.
      if (removed.assets.length) {
        try {
          const cloudinary = cloudinaryClient();
          await Promise.allSettled(
            removed.assets.map((asset) =>
              cloudinary.uploader.destroy(asset.publicId, {
                invalidate: true,
                resource_type: asset.mimeType.startsWith("image/") ? "image" : "raw",
              }),
            ),
          );
        } catch (error) {
          console.error("Parent data was deleted, but Cloudinary cleanup could not start", error);
        }
      }

      res.status(200).json({
        ok: true,
        data: [{ id: removed.id, children: removed.children, applications: removed.applications }],
      });
      return;
    }

    const input = adminParentSchema.parse(req.body);
    const branch = await query<{ id: string }>(
      "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 AND status <> 'INACTIVE'",
      [input.branchId, user!.tenantId],
    );
    if (!branch.rows[0]) throw new AppError(422, "INVALID_BRANCH", "Select an active campus.");

    const result = await query<ParentRow>(
      `UPDATE parent_accounts
       SET name=$3,email=$4,phone=$5,preferred_branch_id=$6,updated_at=now()
       WHERE id=$1 AND tenant_id=$2
       RETURNING id,email::text,name,phone,preferred_branch_id AS "branchId",
         is_active AS "isActive",created_at::text AS "createdAt"`,
      [id, user!.tenantId, input.name, input.email, input.phone, input.branchId],
    );
    if (!result.rows[0]) throw new AppError(404, "PARENT_NOT_FOUND", "Parent not found.");
    res.status(200).json({ ok: true, data: result.rows });
  },
);
