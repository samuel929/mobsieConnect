import { apiHandler, one } from "@/server/api";
import { cloudinaryClient } from "@/server/cloudinary";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { uploadDataUri } from "@/server/uploads";
import { teamMemberUpdateSchema } from "@/server/validation";
import type { TeamMember } from "@/types/domain";

type StoredTeamMember = TeamMember & { imagePublicId?: string | null };

async function removeImage(publicId?: string | null) {
  if (!publicId) return;
  try {
    await cloudinaryClient().uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    // The database mutation has already succeeded. Do not make the dashboard
    // report a failed delete/update solely because asset cleanup failed.
    console.error("Could not remove team member image from Cloudinary", error);
  }
}

export default apiHandler<TeamMember>(
  { methods: ["PUT", "DELETE"], roles: ["PRINCIPAL"] },
  async (req, res, context) => {
    const id = one(req.query.id);
    if (!id) {
      throw new AppError(422, "TEAM_MEMBER_ID_REQUIRED", "A teacher id is required.");
    }

    const tenantId = context.user!.tenantId;
    const current = await query<StoredTeamMember>(
      `SELECT id, branch_id AS "branchId", name, title, bio,
        years_experience AS "yearsExperience", image_url AS "imageUrl",
        image_public_id AS "imagePublicId", is_principal AS "isPrincipal",
        contact_email::text AS "contactEmail", contact_phone AS "contactPhone",
        created_at::text AS "createdAt"
       FROM team_members
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [id, tenantId],
    );
    const member = current.rows[0];
    if (!member) {
      throw new AppError(404, "TEAM_MEMBER_NOT_FOUND", "This teacher no longer exists.");
    }

    if (req.method === "DELETE") {
      const removed = await query<{ id: string }>(
        `DELETE FROM team_members
         WHERE id = $1 AND tenant_id = $2
         RETURNING id`,
        [id, tenantId],
      );
      if (!removed.rows[0]) {
        throw new AppError(404, "TEAM_MEMBER_NOT_FOUND", "This teacher no longer exists.");
      }

      await removeImage(member.imagePublicId);
      res.status(200).json({ ok: true, data: member });
      return;
    }

    const input = teamMemberUpdateSchema.parse({ ...req.body, id });
    if (input.branchId) {
      const branch = await query<{ id: string }>(
        "SELECT id FROM branches WHERE id = $1 AND tenant_id = $2 AND status <> 'INACTIVE' LIMIT 1",
        [input.branchId, tenantId],
      );
      if (!branch.rows[0]) {
        throw new AppError(422, "BRANCH_NOT_FOUND", "Select a current campus before saving this teacher.");
      }
    }

    const upload = input.imageData ? await uploadDataUri(input.imageData, "team") : null;
    const updated = await query<StoredTeamMember>(
      `UPDATE team_members
       SET branch_id = COALESCE($3::uuid, branch_id),
           name = COALESCE($4, name),
           title = COALESCE($5, title),
           bio = CASE WHEN $6::boolean THEN $7 ELSE bio END,
           years_experience = COALESCE($8::int, years_experience),
           image_url = COALESCE($9, image_url),
           image_public_id = COALESCE($10, image_public_id),
           is_principal = COALESCE($11::boolean, is_principal),
           contact_email = CASE WHEN $12::boolean THEN NULLIF($13, '') ELSE contact_email END,
           contact_phone = CASE WHEN $14::boolean THEN NULLIF($15, '') ELSE contact_phone END,
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, branch_id AS "branchId", name, title, bio,
         years_experience AS "yearsExperience", image_url AS "imageUrl",
         image_public_id AS "imagePublicId", is_principal AS "isPrincipal",
         contact_email::text AS "contactEmail", contact_phone AS "contactPhone",
         created_at::text AS "createdAt"`,
      [
        id,
        tenantId,
        input.branchId ?? null,
        input.name ?? null,
        input.title ?? null,
        Object.prototype.hasOwnProperty.call(input, "bio"),
        input.bio ?? null,
        input.yearsExperience ?? null,
        upload?.url ?? null,
        upload?.publicId ?? null,
        input.isPrincipal ?? null,
        Object.prototype.hasOwnProperty.call(input, "contactEmail"),
        input.contactEmail ?? null,
        Object.prototype.hasOwnProperty.call(input, "contactPhone"),
        input.contactPhone ?? null,
      ],
    );
    const saved = updated.rows[0];
    if (!saved) {
      if (upload) await removeImage(upload.publicId);
      throw new AppError(404, "TEAM_MEMBER_NOT_FOUND", "This teacher no longer exists.");
    }

    if (upload) await removeImage(member.imagePublicId);
    res.status(200).json({ ok: true, data: saved });
  },
);
