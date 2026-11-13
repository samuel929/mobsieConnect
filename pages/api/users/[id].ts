import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiHandler, one } from "@/server/api";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { requireDashboardPermission } from "@/server/auth";

type DeletedUser = {
  id: string;
  name: string;
  email: string;
};

const updateUserSchema = z.object({
  dashboardRoleId: z.uuid().optional(),
  branchId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
}).refine((value) => Object.keys(value).length > 0, "Choose a user setting to update.");

function userId(value: string | string[] | undefined) {
  const id = one(value);
  if (!id) throw new AppError(400, "INVALID_USER_ID", "A user id is required.");
  return id;
}

export default apiHandler<DeletedUser>(
  { methods: ["PUT", "DELETE"], roles: ["PRINCIPAL"] },
  async (req, res, { user }) => {
    await requireDashboardPermission(user!, "User management");
    const id = userId(req.query.id);
    if (req.method === "PUT") {
      const input = updateUserSchema.parse(req.body);
      if (id === user!.id && input.isActive === false) {
        throw new AppError(409, "CANNOT_SUSPEND_SELF", "You cannot suspend the account you are currently using.");
      }
      const updated = await withTransaction(async (client) => {
        const target = await client.query<{ id: string }>(
          "SELECT id FROM users WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
          [id, user!.tenantId],
        );
        if (!target.rows[0]) throw new AppError(404, "USER_NOT_FOUND", "The user account was not found.");
        if (input.branchId) {
          const branch = await client.query("SELECT 1 FROM branches WHERE id=$1 AND tenant_id=$2", [input.branchId, user!.tenantId]);
          if (!branch.rows[0]) throw new AppError(422, "BRANCH_NOT_FOUND", "Select a valid campus.");
        }
        if (input.dashboardRoleId) {
          const role = await client.query<{ name: string }>("SELECT name FROM dashboard_roles WHERE id=$1 AND tenant_id=$2", [input.dashboardRoleId, user!.tenantId]);
          if (!role.rows[0]) throw new AppError(422, "ROLE_NOT_FOUND", "Select a valid dashboard role.");
          await client.query(
            `INSERT INTO user_dashboard_roles(user_id,role_id) VALUES($1,$2)
             ON CONFLICT(user_id) DO UPDATE SET role_id=EXCLUDED.role_id,assigned_at=now()`,
            [id, input.dashboardRoleId],
          );
          await client.query("UPDATE users SET role=$2,updated_at=now() WHERE id=$1", [id, role.rows[0].name === "Teacher" ? "TEACHER" : "PRINCIPAL"]);
        }
        const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
        const result = await client.query<DeletedUser & { branchId: string | null; branchName: string | null; isActive: boolean; dashboardRoleId: string | null; dashboardRoleName: string | null }>(
          `UPDATE users u SET
             branch_id=CASE WHEN $3::boolean THEN $4::uuid ELSE branch_id END,
             is_active=COALESCE($5::boolean,is_active),
             password_hash=COALESCE($6,password_hash),updated_at=now()
           FROM (SELECT 1) marker
           WHERE u.id=$1 AND u.tenant_id=$2
           RETURNING u.id,u.name,u.email::text,u.branch_id AS "branchId",u.is_active AS "isActive"`,
          [id, user!.tenantId, Object.prototype.hasOwnProperty.call(input, "branchId"), input.branchId ?? null, input.isActive ?? null, passwordHash],
        );
        const row = result.rows[0];
        const details = await client.query<{ branchName: string | null; dashboardRoleId: string | null; dashboardRoleName: string | null }>(
          `SELECT b.name AS "branchName",dr.id AS "dashboardRoleId",dr.name AS "dashboardRoleName"
           FROM users u LEFT JOIN branches b ON b.id=u.branch_id
           LEFT JOIN user_dashboard_roles udr ON udr.user_id=u.id
           LEFT JOIN dashboard_roles dr ON dr.id=udr.role_id WHERE u.id=$1`,
          [id],
        );
        await client.query(
          `INSERT INTO audit_log (tenant_id,actor_id,action,entity_type,metadata)
           VALUES ($1,$2,'Updated user access','user',$3::jsonb)`,
          [user!.tenantId, user!.id, JSON.stringify({ userId: id, roleId: input.dashboardRoleId, branchId: input.branchId, isActive: input.isActive, passwordChanged: Boolean(input.password) })],
        );
        return { ...row, ...details.rows[0] };
      });
      res.status(200).json({ ok: true, data: updated });
      return;
    }
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
