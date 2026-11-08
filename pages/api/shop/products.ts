import { apiHandler, one, pageLimit, pageNumber } from "@/server/api";
import { query } from "@/server/db";
import { approximateDataUriBytes, uploadDataUri } from "@/server/uploads";
import { shopProductSchema } from "@/server/validation";
import { getRequestUser, requireRole } from "@/server/auth";
import { AppError } from "@/server/errors";
import { z } from "zod";

export const config = { api: { bodyParser: { sizeLimit: "14mb" } } };

type ProductRow = {
  id: string; name: string; category: string; price: number; stock: number; sold: number;
  status: string; imageUrl: string | null; colors: string[]; totalCount?: string;
};

export default apiHandler<ProductRow[]>(
  { methods: ["GET", "POST", "PUT", "DELETE"], auth: false },
  async (req, res) => {
    const user = await getRequestUser(req).catch(() => null);
    if (req.method !== "GET") {
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
      requireRole(user, ["PRINCIPAL"]);
    }
    const tenantId = user?.tenantId ?? one(req.query.tenantId);
    if (!tenantId) throw new AppError(422, "TENANT_REQUIRED", "A tenantId is required.");
    if (req.method === "GET") {
      const page = pageNumber(req.query.page);
      const limit = pageLimit(req.query.limit, 100);
      const search = (one(req.query.search) ?? "").trim();
      const result = await query<ProductRow>(
        `SELECT id, name, category, price_cents / 100.0 AS price, stock, sold, status, colors,
           image_url AS "imageUrl", count(*) OVER()::text AS "totalCount"
         FROM shop_products WHERE tenant_id = $1 AND deleted_at IS NULL
           AND ($2 = '' OR name ILIKE $2 OR category ILIKE $2)
         ORDER BY updated_at DESC, id DESC LIMIT $3 OFFSET $4`,
        [tenantId, search ? `%${search}%` : "", limit, (page - 1) * limit],
      );
      const total = Number(result.rows[0]?.totalCount ?? 0);
      res.status(200).json({ ok: true, data: result.rows, meta: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) } });
      return;
    }
    if (req.method === "DELETE") {
      const id = z.uuid().parse(req.body?.id ?? one(req.query.id));
      const result = await query<ProductRow>(
        `UPDATE shop_products SET status='HIDDEN',deleted_at=now(),updated_at=now()
         WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
         RETURNING id,name,category,price_cents/100.0 AS price,stock,sold,status,image_url AS "imageUrl"`,
        [id, tenantId],
      );
      if (!result.rows[0]) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product was not found.");
      res.status(200).json({ ok: true, data: result.rows });
      return;
    }
    const input = shopProductSchema.parse(req.body);
    if (input.imageData && approximateDataUriBytes(input.imageData) > 8 * 1024 * 1024) {
      throw new AppError(413, "FILE_TOO_LARGE", "Product images must be smaller than 8 MB.");
    }
    const upload = input.imageData ? await uploadDataUri(input.imageData, "shop") : null;
    const status = input.stock === 0 ? "OUT_OF_STOCK" : input.status;
    const result = input.id
      ? await query<ProductRow>(
          `UPDATE shop_products SET name=$3, category=$4, price_cents=$5, stock=$6, status=$7,colors=$8,
             image_url=COALESCE($9,image_url), image_public_id=COALESCE($10,image_public_id), updated_at=now()
           WHERE id=$1 AND tenant_id=$2
           RETURNING id,name,category,price_cents/100.0 AS price,stock,sold,status,colors,image_url AS "imageUrl"`,
          [input.id, tenantId, input.name, input.category, Math.round(input.price * 100), input.stock, status, input.colors, upload?.url ?? null, upload?.publicId ?? null],
        )
      : await query<ProductRow>(
          `INSERT INTO shop_products
             (tenant_id,name,category,price_cents,stock,status,colors,image_url,image_public_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id,name,category,price_cents/100.0 AS price,stock,sold,status,colors,image_url AS "imageUrl"`,
          [tenantId, input.name, input.category, Math.round(input.price * 100), input.stock, status, input.colors, upload?.url ?? null, upload?.publicId ?? null],
        );
    res.status(input.id ? 200 : 201).json({ ok: true, data: result.rows });
  },
);
