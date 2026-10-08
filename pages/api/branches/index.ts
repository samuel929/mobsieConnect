import { apiHandler, one, pageLimit } from "@/server/api";
import { query } from "@/server/db";
import { branchSchema, branchUpdateSchema } from "@/server/validation";
import { uploadDataUri } from "@/server/uploads";
import { AppError } from "@/server/errors";
import type { Branch } from "@/types/domain";
import { assertCurrentSession, getRequestUser, requireRole } from "@/server/auth";

type BranchRow = Branch & { totalCount: string };

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default apiHandler<unknown>(
  { methods: ["GET", "POST", "PUT", "DELETE"], auth: false },
  async (req, res) => {
    // Branches are public read-only data for the parent app. Every mutation is
    // restricted to a current principal session; a tenant query string must
    // never be enough to create, edit or delete a campus.
    const user = req.method !== "GET" ? await getRequestUser(req) : null;
    if (req.method !== "GET") {
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
    if (req.method === "DELETE") {
      const id = one(req.query.id) ?? (typeof req.body === "object" && req.body ? String((req.body as { id?: unknown }).id ?? "") : "");
      if (!id) throw new AppError(422, "BRANCH_REQUIRED", "Choose a campus to delete.");
      const dependencies = await query<{ count: string }>(
        `SELECT (SELECT count(*) FROM students WHERE tenant_id=$1 AND branch_id=$2)
              + (SELECT count(*) FROM applications a JOIN application_preferences p ON p.application_id=a.id WHERE a.tenant_id=$1 AND p.branch_id=$2) AS count`,
        [tenantId, id],
      );
      if (Number(dependencies.rows[0]?.count ?? 0) > 0) {
        throw new AppError(409, "BRANCH_IN_USE", "This campus has learners or applications. Move them before deleting the campus.");
      }
      const removed = await query<{ id: string }>("DELETE FROM branches WHERE id=$1 AND tenant_id=$2 RETURNING id", [id, tenantId]);
      if (!removed.rows[0]) throw new AppError(404, "BRANCH_NOT_FOUND", "That campus no longer exists.");
      res.status(200).json({ ok: true, data: removed.rows });
      return;
    }
    if (req.method === "POST") {
      const input = branchSchema.parse(req.body);
      const upload = await uploadDataUri(input.imageData, "branches");
      const slug = input.name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_-]+/g, "-");
      const result = await query<BranchRow>(
        `INSERT INTO branches (
          tenant_id, name, slug, city, region, address, phone, email, image_url,
          principal_name, principal_email, principal_phone, status, image_public_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id, name, slug, city, region, address, phone, email::text,
          image_url AS "imageUrl", principal_name AS "principalName", principal_email::text AS "principalEmail",
          principal_phone AS "principalPhone", learner_count AS "learnerCount",
          teacher_count AS "teacherCount", attendance_rate::float AS "attendanceRate",
          status, created_at::text AS "createdAt", '1' AS "totalCount"`,
        [
          tenantId,
          input.name,
          slug,
          input.city,
          input.region,
          input.address,
          input.phone,
          input.email,
          upload.url,
          input.principalName,
          input.principalEmail,
          input.principalPhone,
          input.status,
          upload.publicId,
        ],
      );
      res.status(201).json({ ok: true, data: result.rows });
      return;
    }

    if (req.method === "PUT") {
      const input = branchUpdateSchema.parse(req.body);
      const upload = input.imageData ? await uploadDataUri(input.imageData, "branches") : null;
      const result = await query<BranchRow>(
        `UPDATE branches SET
          name=COALESCE($3,name), city=COALESCE($4,city), region=COALESCE($5,region),
          address=COALESCE($6,address), phone=COALESCE($7,phone), email=COALESCE($8,email),
          principal_name=COALESCE($9,principal_name), principal_email=COALESCE($10,principal_email),
          principal_phone=COALESCE($11,principal_phone), status=COALESCE($12,status),
          image_url=COALESCE($13,image_url), image_public_id=COALESCE($14,image_public_id), updated_at=now()
         WHERE id=$1 AND tenant_id=$2
         RETURNING id, name, slug, city, region, address, phone, email::text,
          image_url AS "imageUrl", principal_name AS "principalName", principal_email::text AS "principalEmail",
          principal_phone AS "principalPhone", learner_count AS "learnerCount",
          teacher_count AS "teacherCount", attendance_rate::float AS "attendanceRate",
          status, created_at::text AS "createdAt", '1' AS "totalCount"`,
        [input.id, tenantId, input.name ?? null, input.city ?? null, input.region ?? null,
          input.address ?? null, input.phone ?? null, input.email ?? null, input.principalName ?? null,
          input.principalEmail ?? null, input.principalPhone ?? null, input.status ?? null,
          upload?.url ?? null, upload?.publicId ?? null],
      );
      if (!result.rows[0]) {
        res.status(404).json({ ok: false, error: { code: "BRANCH_NOT_FOUND", message: "That campus no longer exists." } });
        return;
      }
      res.status(200).json({ ok: true, data: result.rows });
      return;
    }

    const limit = pageLimit(req.query.limit);
    const search = (one(req.query.search) ?? "").trim();
    const cursor = one(req.query.cursor);
    const values: unknown[] = [tenantId, limit + 1];
    let cursorSql = "";
    if (cursor) {
      values.push(cursor);
      cursorSql = `AND b.id < $${values.length}`;
    }
    values.push(search ? `%${search}%` : "");
    const searchIndex = values.length;
    const result = await query<BranchRow>(
      `SELECT b.id, b.name, b.slug, b.city, b.region, b.address, b.phone,
        b.email::text, b.image_url AS "imageUrl", b.principal_name AS "principalName", b.principal_email::text AS "principalEmail",
        b.principal_phone AS "principalPhone", b.learner_count AS "learnerCount",
        b.teacher_count AS "teacherCount", b.attendance_rate::float AS "attendanceRate",
        b.status, b.created_at::text AS "createdAt",
        count(*) OVER()::text AS "totalCount"
       FROM branches b
       WHERE b.tenant_id = $1 ${cursorSql}
         AND ($${searchIndex} = '' OR b.name ILIKE $${searchIndex} OR b.city ILIKE $${searchIndex})
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT $2`,
      values,
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    res.status(200).json({
      ok: true,
      data: rows,
      meta: {
        nextCursor: hasMore ? rows.at(-1)?.id ?? null : null,
        total: Number(result.rows[0]?.totalCount ?? 0),
      },
    });
  },
);
