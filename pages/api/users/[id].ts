import { apiHandler, one } from "@/server/api";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";

type DeletedUser = {
  id: string;
  name: string;
  email: string;
};

function userId(value: string | string[] | undefined) {
  const id = one(value);
  if (!id) throw new AppError(400, "INVALID_USER_ID", "A user id is required.");
  return id;
}

export default apiHandler<DeletedUser>(
  { methods: ["DELETE"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    const id = userId(req.query.id);
    if (id === user!.id) {
      throw new AppError(
        409,
        "CANNOT_DELETE_SELF",
        "You cannot remove the account you are currently signed in with.",
      );
    }

    const deleted = await withTransaction(async (client) => {
      const target = await client.query<DeletedUser>(
        `SELECT id,name,email::text
         FROM users
         WHERE id=$1 AND tenant_id=$2
         FOR UPDATE`,
        [id, user!.tenantId],
      );
      if (!target.rows[0]) {
        throw new AppError(404, "USER_NOT_FOUND", "The user account was not found.");
      }

      await client.query("DELETE FROM users WHERE id=$1 AND tenant_id=$2", [id, user!.tenantId]);
      await client.query(
        `INSERT INTO audit_log (tenant_id,actor_id,action,entity_type,metadata)
         VALUES ($1,$2,'Deleted user account','user',$3::jsonb)`,
        [
          user!.tenantId,
          user!.id,
          JSON.stringify({
            deletedUserId: target.rows[0].id,
            deletedUserName: target.rows[0].name,
            deletedUserEmail: target.rows[0].email,
          }),
        ],
      );
      return target.rows[0];
    });

    res.status(200).json({ ok: true, data: deleted });
  },
);
