import { apiHandler } from "@/server/api";
import { query } from "@/server/db";

type ProfileRow = { id:string; name:string; email:string; isActive:boolean; createdAt:string; lastLoginAt:string|null; branchId:string|null; branchName:string|null; roleId:string|null; roleName:string; roleColor:string|null; className:string|null; permissions:string[] };

export default apiHandler<ProfileRow>({ methods: ["GET"] }, async (_req, res, { user }) => {
  const result = await query<ProfileRow>(
    `SELECT u.id,u.name,u.email::text,u.is_active AS "isActive",u.created_at::text AS "createdAt",u.last_login_at::text AS "lastLoginAt",
       u.branch_id AS "branchId",b.name AS "branchName",role.id AS "roleId",
       COALESCE(role.name,CASE WHEN u.role='TEACHER' THEN 'Teacher' ELSE 'Principal' END) AS "roleName",
       role.color AS "roleColor",teacher.title AS "className",
       COALESCE(array_agg(DISTINCT permission.permission_key ORDER BY permission.permission_key) FILTER (WHERE permission.granted),'{}') AS permissions
     FROM users u LEFT JOIN branches b ON b.id=u.branch_id
     LEFT JOIN user_dashboard_roles assigned ON assigned.user_id=u.id
     LEFT JOIN dashboard_roles role ON role.id=assigned.role_id AND role.tenant_id=u.tenant_id
     LEFT JOIN dashboard_role_permissions permission ON permission.role_id=role.id
     LEFT JOIN LATERAL (SELECT member.title FROM team_members member WHERE member.tenant_id=u.tenant_id AND member.branch_id=u.branch_id
       AND lower(member.contact_email::text)=lower(u.email::text) ORDER BY member.updated_at DESC,member.created_at DESC LIMIT 1) teacher ON true
     WHERE u.id=$1 AND u.tenant_id=$2 GROUP BY u.id,b.name,role.id,role.name,role.color,teacher.title LIMIT 1`,
    [user!.id, user!.tenantId],
  );
  res.status(200).json({ ok: true, data: result.rows[0] });
});

