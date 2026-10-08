import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { stockAdjustmentSchema } from "@/server/validation";

export default apiHandler<{ id: string; stock: number; status: string }>(
  { methods: ["PUT"], roles: ["PRINCIPAL"] },
  async (req, res, context) => {
    const input = stockAdjustmentSchema.parse(req.body);
    const result = await query<{ id: string; stock: number; status: string }>(
      `UPDATE shop_products SET
         stock=stock+$3,
         status=CASE WHEN stock+$3=0 THEN 'OUT_OF_STOCK' WHEN status='HIDDEN' THEN status ELSE 'ACTIVE' END,
         updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND stock+$3>=0
       RETURNING id,stock,status`,
      [input.productId, context.user!.tenantId, input.quantity],
    );
    if (!result.rows[0]) throw new AppError(422, "INVALID_STOCK", "Stock adjustment would create a negative balance.");
    res.status(200).json({ ok: true, data: result.rows[0] });
  },
);
