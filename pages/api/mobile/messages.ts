import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { getParent } from "@/server/parentAuth";
import { mobileMessageSchema } from "@/server/validation";

type Message = {
  id: string;
  senderType: "PARENT" | "SCHOOL";
  senderName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/** Parent conversation history. It is tenant-scoped in SQL, never by client input. */
export default apiHandler<Message[] | Message>({ methods: ["GET", "POST"], auth: false }, async (req, res) => {
  const parent = await getParent(req);
  if (req.method === "POST") {
    const input = mobileMessageSchema.parse(req.body);
    const saved = await query<Message>(
      `INSERT INTO parent_messages (tenant_id,parent_account_id,sender_type,sender_name,body)
       VALUES ($1,$2,'PARENT',$3,$4)
       RETURNING id,sender_type AS "senderType",sender_name AS "senderName",body,
                 read_at::text AS "readAt",created_at::text AS "createdAt"`,
      [parent.tenantId, parent.id, parent.name, input.body],
    );
    res.status(201).json({ ok: true, data: saved.rows[0] });
    return;
  }
  const messages = await query<Message>(
    `SELECT id,sender_type AS "senderType",sender_name AS "senderName",body,
            read_at::text AS "readAt",created_at::text AS "createdAt"
       FROM parent_messages
      WHERE tenant_id=$1 AND parent_account_id=$2
      ORDER BY created_at ASC, id ASC LIMIT 200`,
    [parent.tenantId, parent.id],
  );
  res.status(200).json({ ok: true, data: messages.rows });
});
