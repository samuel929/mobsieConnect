import { apiHandler } from "@/server/api";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { createParentToken, getParent, type ParentSession } from "@/server/parentAuth";
import { parentProfileSchema } from "@/server/validation";
import { withParentApplicationState, type ParentUser } from "@/server/parentApplicationState";

export default apiHandler<{ user: ParentUser; token?: string }>(
  { methods: ["GET", "PATCH"], auth: false },
  async (req, res) => {
    const parent = await getParent(req);
    if (req.method === "GET") {
      res.status(200).json({ ok: true, data: { user: await withParentApplicationState(parent) } });
      return;
    }

    const input = parentProfileSchema.parse(req.body);
    const user = await withTransaction(async (client) => {
      const duplicate = await client.query<{ id: string }>(
        `SELECT id FROM parent_accounts
         WHERE tenant_id=$1 AND email=$2 AND id<>$3
         LIMIT 1`,
        [parent.tenantId, input.email, parent.id],
      );
      if (duplicate.rowCount) {
        throw new AppError(409, "EMAIL_EXISTS", "That email address is already in use.");
      }

      const updated = await client.query<ParentSession>(
        `UPDATE parent_accounts
         SET name=$1,email=$2,phone=$3,updated_at=now()
         WHERE id=$4 AND tenant_id=$5
         RETURNING id,tenant_id AS "tenantId",email::text,name,phone`,
        [input.name, input.email, input.phone, parent.id, parent.tenantId],
      );
      const nextUser = updated.rows[0];
      if (!nextUser) {
        throw new AppError(404, "PARENT_NOT_FOUND", "Parent account not found.");
      }

      // Keep the dashboard application directory aligned with edits made by
      // the parent. Older applications may still be linked by email only.
      await client.query(
        `UPDATE applications
         SET parent_name=$1,
             parent_email=$2,
             parent_phone=$3,
             parent_account_id=COALESCE(parent_account_id,$4),
             updated_at=now()
         WHERE tenant_id=$5
           AND (
             parent_account_id=$4 OR
             lower(trim(parent_email::text))=lower(trim($6))
           )`,
        [input.name, input.email, input.phone, parent.id, parent.tenantId, parent.email],
      );

      await client.query(
        `UPDATE students
         SET parent_name=$1,updated_at=now()
         WHERE tenant_id=$2 AND parent_account_id=$3`,
        [input.name, parent.tenantId, parent.id],
      );

      return nextUser;
    });
    res.status(200).json({
      ok: true,
      data: { user: await withParentApplicationState(user), token: await createParentToken(user) },
    });
  },
);
