import { apiHandler, one, pageLimit, pageNumber } from "@/server/api";
import { query } from "@/server/db";
import { teamMemberSchema } from "@/server/validation";
import { uploadDataUri } from "@/server/uploads";
import type { TeamMember } from "@/types/domain";
import { assertCurrentSession, getRequestUser, requireRole } from "@/server/auth";
import { AppError } from "@/server/errors";

type TeamRow = TeamMember & { totalCount: string; studentCount?: number };

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default apiHandler<TeamMember[]>(
  { methods: ["GET", "POST"], auth: false },
  async (req, res) => {
    // Team data is public read-only for the mobile directory. Creating a
    // member, however, must always use the authenticated principal tenant;
    // accepting a tenantId from the request body would permit cross-tenant
    // writes.
    const user = req.method === "POST" ? await getRequestUser(req) : null;
    if (req.method === "POST") {
      requireRole(user!, ["PRINCIPAL"]);
      await assertCurrentSession(user!);
    }
    const tenantId = user?.tenantId ?? one(req.query.tenantId);
    if (!tenantId) {
      res.status(422).json({
        ok: false,
        error: { code: "TENANT_REQUIRED", message: "A tenantId query parameter is required." },
      });
      return;
    }
    if (req.method === "POST") {
      const input = teamMemberSchema.parse(req.body);
      const branch = await query<{ id: string }>(
        "SELECT id FROM branches WHERE id = $1 AND tenant_id = $2 LIMIT 1",
        [input.branchId, tenantId],
      );
      if (!branch.rows[0]) {
        throw new AppError(
          422,
          "BRANCH_NOT_FOUND",
          "That campus is no longer available. Refresh the page and select a current campus.",
        );
      }
      const upload = await uploadDataUri(input.imageData, "team");
      const result = await query<TeamRow>(
        `INSERT INTO team_members (
          tenant_id, branch_id, name, title, bio, years_experience, image_url,
          image_public_id, is_principal, contact_email, contact_phone
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id, branch_id AS "branchId", '' AS "branchName", name, title, bio,
          years_experience AS "yearsExperience", image_url AS "imageUrl",
          is_principal AS "isPrincipal", contact_email::text AS "contactEmail",
          contact_phone AS "contactPhone", created_at::text AS "createdAt",
          '1' AS "totalCount"`,
        [
          tenantId,
          input.branchId,
          input.name,
          input.title,
          input.bio ?? null,
          input.yearsExperience,
          upload.url,
          upload.publicId,
          input.isPrincipal,
          input.contactEmail || null,
          input.contactPhone || null,
        ],
      );
      res.status(201).json({ ok: true, data: result.rows });
      return;
    }

    const limit = pageLimit(req.query.limit);
    const page = pageNumber(req.query.page);
    const search = (one(req.query.search) ?? "").trim();
    const branchId = one(req.query.branchId);
    const result = await query<TeamRow>(
      `SELECT t.id, t.branch_id AS "branchId", b.name AS "branchName", t.name, t.title,
        t.bio, t.years_experience AS "yearsExperience", t.image_url AS "imageUrl",
        t.is_principal AS "isPrincipal", t.contact_email::text AS "contactEmail",
        t.contact_phone AS "contactPhone", t.created_at::text AS "createdAt",
        (SELECT COUNT(*)::int FROM students s WHERE s.tenant_id=t.tenant_id AND s.branch_id=t.branch_id AND s.enrollment_status IN ('ENROLLED','ACTIVE')) AS "studentCount",
        count(*) OVER()::text AS "totalCount"
       FROM team_members t
       JOIN branches b ON b.id = t.branch_id
       WHERE t.tenant_id = $1
         AND ($2::text IS NULL OR t.branch_id = $2::uuid)
         AND ($3 = '' OR t.name ILIKE $3 OR t.title ILIKE $3)
       ORDER BY t.is_principal DESC, t.display_order, t.id
       LIMIT $4 OFFSET $5`,
      [tenantId, branchId ?? null, search ? `%${search}%` : "", limit, (page - 1) * limit],
    );
    res.status(200).json({
      ok: true,
      data: result.rows,
      meta: {
        page,
        pageSize: limit,
        total: Number(result.rows[0]?.totalCount ?? 0),
        totalPages: Math.ceil(Number(result.rows[0]?.totalCount ?? 0) / limit),
      },
    });
  },
);
