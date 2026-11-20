import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { adminParentSchema } from "@/server/validation";
import { requireTeacherScope } from "@/server/teacherScope";

type ParentRow = Record<string, unknown>;

export default apiHandler<ParentRow[]>(
  { methods: ["GET", "POST"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, { user }) => {
    if (req.method === "POST") {
      if (user!.role !== "PRINCIPAL") throw new AppError(403,"FORBIDDEN","Only administrators can create parent accounts.");
      const input = adminParentSchema.parse(req.body);
      const branch = await query<{ id: string }>(
        "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 AND status <> 'INACTIVE'",
        [input.branchId, user!.tenantId],
      );
      if (!branch.rows[0]) throw new AppError(422, "INVALID_BRANCH", "Select an active campus.");
      const result = await query<ParentRow>(
        `INSERT INTO parent_accounts
           (tenant_id,email,name,phone,password_hash,preferred_branch_id,invited_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (tenant_id,email) DO UPDATE SET
           name=EXCLUDED.name,phone=EXCLUDED.phone,
           preferred_branch_id=EXCLUDED.preferred_branch_id,is_active=true,updated_at=now()
         RETURNING id,email::text,name,phone,preferred_branch_id AS "branchId",
           is_active AS "isActive",created_at::text AS "createdAt"`,
        [
          user!.tenantId, input.email, input.name, input.phone,
          await bcrypt.hash(randomUUID(), 12), input.branchId,
        ],
      );
      res.status(201).json({ ok: true, data: result.rows });
      return;
    }

    const search = (one(req.query.search) ?? "").trim();
    const teacherScope = await requireTeacherScope(user!);
    const result = await query<ParentRow>(
      `SELECT p.id,p.email::text,p.name,p.phone,
         COALESCE(student_branch.branch_id,application_branch.branch_id,p.preferred_branch_id) AS "branchId",
         b.name AS "branchName",COALESCE(parent_classes.class_names,ARRAY[]::text[]) AS "classNames",
         p.is_active AS "isActive",
         (SELECT count(*)::int FROM students s WHERE s.parent_account_id=p.id) AS children,
         (SELECT count(*)::int FROM applications a WHERE a.parent_account_id=p.id) AS applications,
         p.last_login_at::text AS "lastLoginAt",p.created_at::text AS "createdAt"
       FROM parent_accounts p
       LEFT JOIN LATERAL (
         SELECT s.branch_id
           FROM students s
          WHERE s.tenant_id=p.tenant_id AND s.parent_account_id=p.id
          ORDER BY s.updated_at DESC,s.created_at DESC
          LIMIT 1
       ) student_branch ON true
       LEFT JOIN LATERAL (
         SELECT ap.branch_id
           FROM applications a
           JOIN application_preferences ap ON ap.application_id=a.id
          WHERE a.tenant_id=p.tenant_id AND a.parent_account_id=p.id
          ORDER BY a.updated_at DESC,a.created_at DESC
          LIMIT 1
       ) application_branch ON true
       LEFT JOIN LATERAL (
         SELECT ARRAY(
           SELECT DISTINCT COALESCE(NULLIF(trim(scoped_class.class_name),''),NULLIF(trim(scoped_class.grade),''))
             FROM students scoped_class
            WHERE scoped_class.tenant_id=p.tenant_id
              AND scoped_class.parent_account_id=p.id
              AND scoped_class.enrollment_status='ENROLLED'
              AND COALESCE(NULLIF(trim(scoped_class.class_name),''),NULLIF(trim(scoped_class.grade),'')) IS NOT NULL
            ORDER BY 1
         ) AS class_names
       ) parent_classes ON true
       LEFT JOIN branches b ON b.id=COALESCE(student_branch.branch_id,application_branch.branch_id,p.preferred_branch_id)
       WHERE p.tenant_id=$1
         AND ($2='' OR p.name ILIKE '%'||$2||'%' OR p.email::text ILIKE '%'||$2||'%')
         AND ($3::uuid IS NULL OR COALESCE(student_branch.branch_id,application_branch.branch_id,p.preferred_branch_id)=$3)
         AND ($4::text IS NULL OR EXISTS (
           SELECT 1 FROM students scoped_student
           WHERE scoped_student.parent_account_id=p.id
             AND scoped_student.tenant_id=p.tenant_id
             AND (regexp_replace(lower(trim(scoped_student.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($4)),'[_ -]+','','g')
               OR regexp_replace(lower(trim(scoped_student.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($4)),'[_ -]+','','g'))
         ))
       ORDER BY p.created_at DESC,p.id DESC`,
      [user!.tenantId, search, user!.branchId, teacherScope?.className ?? null],
    );
    res.status(200).json({ ok: true, data: result.rows });
  },
);
