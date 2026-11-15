import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { requireDashboardPermission } from "@/server/auth";
import { dashboardRoleAccessPolicy } from "@/server/roleAccess";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must contain at least 8 characters.").max(128),
  role: z.enum(["PRINCIPAL", "TEACHER"]).optional(),
  branchId: z.uuid().nullable().optional(),
  dashboardRoleId: z.uuid().nullable().optional(),
  teamMemberId: z.uuid().nullable().optional(),
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "PRINCIPAL" | "TEACHER";
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  dashboardRoleId?: string | null;
  dashboardRoleName?: string | null;
  dashboardRoleColor?: string | null;
  teamMemberId?: string | null;
  className?: string | null;
};

export default apiHandler<UserRow[]>({ methods: ["GET", "POST"], roles: ["PRINCIPAL"] }, async (req, res, { user }) => {
  await requireDashboardPermission(user!, "User management");
  if (req.method === "GET") {
    const result = await query<UserRow>(
      `SELECT u.id,u.name,u.email::text,u.role,u.branch_id AS "branchId",b.name AS "branchName",
        u.is_active AS "isActive",u.last_login_at::text AS "lastLoginAt",u.created_at::text AS "createdAt",
        dr.id AS "dashboardRoleId",dr.name AS "dashboardRoleName",dr.color AS "dashboardRoleColor",
        teacher.id AS "teamMemberId",teacher.title AS "className"
       FROM users u LEFT JOIN branches b ON b.id=u.branch_id
       LEFT JOIN user_dashboard_roles udr ON udr.user_id=u.id
       LEFT JOIN dashboard_roles dr ON dr.id=udr.role_id
       LEFT JOIN LATERAL (
         SELECT member.id,member.title FROM team_members member
         WHERE member.tenant_id=u.tenant_id AND member.branch_id=u.branch_id
           AND lower(member.contact_email::text)=lower(u.email::text)
         ORDER BY member.updated_at DESC LIMIT 1
       ) teacher ON true
       WHERE u.tenant_id=$1 ORDER BY u.created_at DESC`,
      [user!.tenantId],
    );
    res.status(200).json({ ok: true, data: result.rows });
    return;
  }

  const input = createUserSchema.parse(req.body);
  if (!input.dashboardRoleId) {
    throw new AppError(422, "ROLE_REQUIRED", "Select a dashboard role.");
  }
  const dashboardRoleResult = await query<{ name: string }>(
    "SELECT name FROM dashboard_roles WHERE id=$1 AND tenant_id=$2",
    [input.dashboardRoleId, user!.tenantId],
  );
  const dashboardRole = dashboardRoleResult.rows[0];
  if (!dashboardRole) throw new AppError(422, "ROLE_NOT_FOUND", "Select a valid dashboard role.");
  const accessPolicy = dashboardRoleAccessPolicy(dashboardRole.name);
  const branchId = accessPolicy.isGlobal ? null : (input.branchId ?? null);
  if (accessPolicy.requiresBranch && !branchId) {
    throw new AppError(422, "CAMPUS_SCOPE_REQUIRED", `${dashboardRole.name} access must be assigned to a campus.`);
  }
  if (branchId) {
    const branch = await query("SELECT 1 FROM branches WHERE id=$1 AND tenant_id=$2", [branchId, user!.tenantId]);
    if (!branch.rows[0]) throw new AppError(422, "BRANCH_NOT_FOUND", "Select a valid campus.");
  }
  let teacherProfile: { id: string; className: string } | null = null;
  if (accessPolicy.requiresTeacherProfile) {
    if (!branchId || !input.teamMemberId) {
      throw new AppError(422,"TEACHER_SCOPE_REQUIRED","Select the teacher profile, campus, and class for this login.");
    }
    const profile=await query<{id:string;className:string}>(
      `SELECT id,title AS "className" FROM team_members
       WHERE id=$1 AND tenant_id=$2 AND branch_id=$3 LIMIT 1`,
      [input.teamMemberId,user!.tenantId,branchId],
    );
    teacherProfile=profile.rows[0]??null;
    if(!teacherProfile) throw new AppError(422,"TEACHER_PROFILE_NOT_FOUND","Select a teacher profile from the chosen campus.");
  }
  const duplicate = await query("SELECT 1 FROM users WHERE tenant_id=$1 AND email=$2", [user!.tenantId, input.email]);
  if (duplicate.rows[0]) throw new AppError(409, "EMAIL_IN_USE", "A user with this email already exists.");

  const result = await query<UserRow>(
    `WITH inserted AS (
       INSERT INTO users (tenant_id,branch_id,email,name,password_hash,role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *
     )
     SELECT i.id,i.name,i.email::text,i.role,i.branch_id AS "branchId",b.name AS "branchName",
       i.is_active AS "isActive",i.last_login_at::text AS "lastLoginAt",i.created_at::text AS "createdAt"
     FROM inserted i LEFT JOIN branches b ON b.id=i.branch_id`,
    [user!.tenantId, branchId, input.email, input.name, await bcrypt.hash(input.password, 12), accessPolicy.requiresTeacherProfile ? "TEACHER" : "PRINCIPAL"],
  );
  if(input.dashboardRoleId){
    await query(`INSERT INTO user_dashboard_roles(user_id,role_id) VALUES($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET role_id=EXCLUDED.role_id,assigned_at=now()`,[result.rows[0].id,input.dashboardRoleId]);
  }
  if(teacherProfile){
    await query(
      `UPDATE team_members SET contact_email=$3,updated_at=now()
       WHERE id=$1 AND tenant_id=$2`,
      [teacherProfile.id,user!.tenantId,input.email],
    );
    Object.assign(result.rows[0],{teamMemberId:teacherProfile.id,className:teacherProfile.className});
  }
  res.status(201).json({ ok: true, data: result.rows });
});
