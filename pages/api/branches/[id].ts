import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { branchSchema } from "@/server/validation";

type BranchMutation = {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  region?: string;
  address?: string;
  phone?: string;
  email?: string;
  imageUrl?: string | null;
  principalName?: string | null;
  principalEmail?: string | null;
  principalPhone?: string | null;
  status?: "ACTIVE" | "COMING_SOON" | "INACTIVE";
};

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\\w\\s-]/g, "")
    .trim()
    .replace(/[\\s_-]+/g, "-");
}

/**
 * Removing a branch is intentionally implemented as an archive. Branches are
 * referenced by applications, learners, attendance and other historical
 * records, so physically deleting one would either destroy history or violate
 * foreign-key constraints. INACTIVE branches are excluded from all normal
 * branch feeds, including the parent mobile app.
 */
export default apiHandler<BranchMutation>(
  { methods: ["PUT", "DELETE"], roles: ["PRINCIPAL"] },
  async (req, res, context) => {
    const id = one(req.query.id);
    if (!id) {
      throw new AppError(422, "BRANCH_ID_REQUIRED", "A branch id is required.");
    }

    if (req.method === "PUT") {
      const input = branchSchema.parse(req.body);
      const slug = toSlug(input.name);

      const duplicate = await query<{ id: string }>(
        `SELECT id
         FROM branches
         WHERE tenant_id = $1 AND slug = $2 AND id <> $3 AND status <> 'INACTIVE'
         LIMIT 1`,
        [context.user!.tenantId, slug, id],
      );
      if (duplicate.rows[0]) {
        throw new AppError(409, "BRANCH_NAME_EXISTS", "A branch with this name already exists.");
      }

      const result = await query<BranchMutation>(
        `UPDATE branches
         SET name = $3,
             slug = $4,
             city = $5,
             region = $6,
             address = $7,
             phone = $8,
             email = $9,
             image_url = $10,
             principal_name = $11,
             principal_email = $12,
             principal_phone = $13,
             status = $14,
             updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND status <> 'INACTIVE'
         RETURNING id, name, slug, city, region, address, phone, email::text,
           image_url AS "imageUrl", principal_name AS "principalName",
           principal_email::text AS "principalEmail", principal_phone AS "principalPhone", status`,
        [
          id,
          context.user!.tenantId,
          input.name,
          slug,
          input.city,
          input.region,
          input.address,
          input.phone,
          input.email,
          input.imageUrl ?? null,
          input.principalName,
          input.principalEmail,
          input.principalPhone,
          input.status,
        ],
      );
      const branch = result.rows[0];
      if (!branch) {
        throw new AppError(404, "BRANCH_NOT_FOUND", "The branch no longer exists.");
      }
      res.status(200).json({ ok: true, data: branch });
      return;
    }

    const result = await query<BranchMutation>(
      `UPDATE branches
       SET status = 'INACTIVE', updated_at = now()
       WHERE id = $1
         AND tenant_id = $2
         AND status <> 'INACTIVE'
       RETURNING id, name`,
      [id, context.user!.tenantId],
    );
    const branch = result.rows[0];
    if (!branch) {
      throw new AppError(404, "BRANCH_NOT_FOUND", "The branch no longer exists.");
    }

    res.status(200).json({ ok: true, data: branch });
  },
);
