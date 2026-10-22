import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { getParent } from "@/server/parentAuth";
import { mobileFeedbackSchema } from "@/server/validation";

type FeedbackRow = {
  id: string;
  category: string;
  message: string;
  rating: number | null;
  status: string;
  reply: string | null;
  repliedAt: string | null;
  repliedByName: string | null;
  createdAt: string;
};

export default apiHandler<FeedbackRow | FeedbackRow[]>({ methods: ["GET", "POST"], auth: false }, async (req, res) => {
  const parent = await getParent(req);
  if (req.method === "GET") {
    const feedback = await query<FeedbackRow>(
      `SELECT f.id,f.category,f.message,f.rating,f.status,f.reply,
          f.replied_at::text AS "repliedAt",u.name AS "repliedByName",
          f.created_at::text AS "createdAt"
         FROM parent_feedback f
         LEFT JOIN users u ON u.id=f.replied_by
        WHERE f.tenant_id=$1 AND f.parent_account_id=$2
        ORDER BY f.created_at DESC,f.id DESC
        LIMIT 100`,
      [parent.tenantId, parent.id],
    );
    res.status(200).json({ ok: true, data: feedback.rows });
    return;
  }
  const input = mobileFeedbackSchema.parse(req.body);
  const saved = await query<FeedbackRow>(
    `INSERT INTO parent_feedback (tenant_id,parent_account_id,category,message,rating)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, category, message, rating, status, reply,
       replied_at::text AS "repliedAt",NULL::text AS "repliedByName",
       created_at::text AS "createdAt"`,
    [parent.tenantId, parent.id, input.category, input.message, input.rating ?? null],
  );
  res.status(201).json({ ok: true, data: saved.rows[0] });
});
