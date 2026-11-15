import { apiHandler, one } from "@/server/api";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { adminParentSchema } from "@/server/validation";
import { cloudinaryClient } from "@/server/cloudinary";
import { requireTeacherScope } from "@/server/teacherScope";

type ParentRow = Record<string, unknown>;

function parentId(value: string | string[] | undefined) {
  const id = one(value);
  if (!id) throw new AppError(400, "INVALID_PARENT_ID", "A parent id is required.");
  return id;
}

export default apiHandler<unknown>(
  { methods: ["GET", "PUT", "DELETE"], roles: ["PRINCIPAL", "TEACHER"] },
  async (req, res, { user }) => {
    const id = parentId(req.query.id);
    if (req.method !== "GET" && user!.role !== "PRINCIPAL") {
      throw new AppError(403,"FORBIDDEN","Only administrators can change parent accounts.");
    }

    if (req.method === "GET") {
      const teacherScope = await requireTeacherScope(user!);
      if (teacherScope) {
        const permitted = await query(
          `SELECT 1 FROM students s WHERE s.parent_account_id=$1 AND s.tenant_id=$2 AND s.branch_id=$3
           AND (regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($4)),'[_ -]+','','g')
             OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($4)),'[_ -]+','','g')) LIMIT 1`,
          [id,user!.tenantId,teacherScope.branchId,teacherScope.className],
        );
        if (!permitted.rows[0]) throw new AppError(404,"PARENT_NOT_FOUND","Parent not found in your assigned class.");
      }
      const parent = await query<ParentRow>(
        `SELECT p.id,p.name,p.email::text AS email,p.phone,p.is_active AS "isActive",
           p.last_login_at::text AS "lastLoginAt",p.created_at::text AS "createdAt",
           COALESCE(student_branch.id,application_branch.id,p.preferred_branch_id) AS "branchId",
           COALESCE(student_branch.name,application_branch.name,preferred_branch.name) AS "branchName"
         FROM parent_accounts p
         LEFT JOIN branches preferred_branch ON preferred_branch.id=p.preferred_branch_id
         LEFT JOIN LATERAL (
           SELECT b.id,b.name FROM students s JOIN branches b ON b.id=s.branch_id
           WHERE s.parent_account_id=p.id AND s.tenant_id=p.tenant_id
           ORDER BY s.created_at DESC LIMIT 1
         ) student_branch ON true
         LEFT JOIN LATERAL (
           SELECT b.id,b.name FROM applications a
           JOIN application_preferences preference ON preference.application_id=a.id
           JOIN branches b ON b.id=preference.branch_id
           WHERE a.parent_account_id=p.id AND a.tenant_id=p.tenant_id
           ORDER BY a.created_at DESC LIMIT 1
         ) application_branch ON true
         WHERE p.id=$1 AND p.tenant_id=$2 LIMIT 1`,
        [id, user!.tenantId],
      );
      if (!parent.rows[0]) throw new AppError(404, "PARENT_NOT_FOUND", "Parent not found.");

      const [children, applications, applicationPayments, orders, invoices] = await Promise.all([
        query<ParentRow>(
          `SELECT s.id,s.name,s.date_of_birth::text AS "dateOfBirth",s.grade,
             s.class_name AS "className",s.enrollment_status AS "enrollmentStatus",
             s.attendance_rate::float AS "attendanceRate",b.id AS "branchId",b.name AS "branchName",
             s.created_at::text AS "createdAt"
           FROM students s JOIN branches b ON b.id=s.branch_id
           WHERE s.parent_account_id=$1 AND s.tenant_id=$2
             AND ($3::uuid IS NULL OR (s.branch_id=$3 AND
               (regexp_replace(lower(trim(s.grade)),'[_ -]+','','g')=regexp_replace(lower(trim($4)),'[_ -]+','','g')
                OR regexp_replace(lower(trim(s.class_name)),'[_ -]+','','g')=regexp_replace(lower(trim($4)),'[_ -]+','','g'))))
           ORDER BY s.created_at DESC`,
          [id, user!.tenantId, teacherScope?.branchId ?? null, teacherScope?.className ?? null],
        ),
        query<ParentRow>(
          `SELECT a.id,a.reference,a.child_name AS "childName",a.current_grade AS grade,
             a.status,a.application_type AS "applicationType",a.submitted_at::text AS "submittedAt",
             a.created_at::text AS "createdAt",b.id AS "branchId",b.name AS "branchName"
           FROM applications a
           LEFT JOIN application_preferences preference ON preference.application_id=a.id
           LEFT JOIN branches b ON b.id=preference.branch_id
           WHERE a.parent_account_id=$1 AND a.tenant_id=$2
             AND ($3::uuid IS NULL OR (preference.branch_id=$3 AND
               regexp_replace(lower(trim(a.current_grade)),'[_ -]+','','g')=regexp_replace(lower(trim($4)),'[_ -]+','','g')))
           ORDER BY a.created_at DESC`,
          [id, user!.tenantId, teacherScope?.branchId ?? null, teacherScope?.className ?? null],
        ),
        query<ParentRow>(
          `SELECT payment.id,payment.merchant_payment_id AS "merchantPaymentId",
             payment.pf_payment_id AS "payFastPaymentId",payment.status,
             COALESCE(payment.amount_gross_cents,payment.amount_cents) AS "amountCents",
             COALESCE(payment.payment_method,NULLIF(payment.payment_payload->>'payment_method',''),'payfast') AS method,
             application.reference,application.child_name AS "childName",
             COALESCE(NULLIF(payment.payment_payload->>'item_description',''),'Registration fee for ' || application.child_name) AS description,
             payment.paid_at::text AS "paidAt",payment.created_at::text AS "createdAt"
           FROM application_payments payment
           JOIN applications application ON application.id=payment.application_id
           WHERE application.parent_account_id=$1 AND application.tenant_id=$2
           ORDER BY COALESCE(payment.paid_at,payment.created_at) DESC`,
          [id, user!.tenantId],
        ),
        query<ParentRow>(
          `SELECT o.id,o.reference,o.total_cents AS "totalCents",o.status,
             o.created_at::text AS "createdAt",b.name AS "branchName",
             COALESCE(json_agg(json_build_object(
               'id',item.id,'name',item.product_name,'quantity',item.quantity,
               'unitPriceCents',item.unit_price_cents
             ) ORDER BY item.id) FILTER (WHERE item.id IS NOT NULL),'[]'::json) AS items,
             payment.status AS "paymentStatus",payment.merchant_payment_id AS "merchantPaymentId",
             payment.pf_payment_id AS "payFastPaymentId",
             COALESCE(payment.payment_method,NULLIF(payment.payment_payload->>'payment_method',''),'payfast') AS "paymentMethod",
             payment.paid_at::text AS "paidAt"
           FROM shop_orders o
           LEFT JOIN branches b ON b.id=o.branch_id
           LEFT JOIN shop_order_items item ON item.order_id=o.id
           LEFT JOIN LATERAL (
             SELECT shop_payment.* FROM shop_order_payments shop_payment
             WHERE shop_payment.order_id=o.id
             ORDER BY shop_payment.created_at DESC LIMIT 1
           ) payment ON true
           WHERE o.parent_account_id=$1 AND o.tenant_id=$2
           GROUP BY o.id,b.name,payment.status,payment.merchant_payment_id,payment.pf_payment_id,
             payment.payment_method,payment.payment_payload,payment.paid_at
           ORDER BY o.created_at DESC`,
          [id, user!.tenantId],
        ),
        query<ParentRow>(
          `SELECT i.id,i.invoice_number AS "invoiceNumber",i.description,
             i.amount_cents AS "amountCents",i.issued_on::text AS "issuedOn",
             i.due_on::text AS "dueOn",i.status,i.paid_at::text AS "paidAt",
             i.created_at::text AS "createdAt",b.name AS "branchName"
           FROM invoices i LEFT JOIN branches b ON b.id=i.branch_id
           WHERE i.parent_account_id=$1 AND i.tenant_id=$2
           ORDER BY i.created_at DESC`,
          [id, user!.tenantId],
        ),
      ]);

      res.status(200).json({
        ok: true,
        data: {
          parent: parent.rows[0],
          children: children.rows,
          applications: applications.rows,
          payments: teacherScope ? [] : applicationPayments.rows,
          orders: teacherScope ? [] : orders.rows,
          invoices: teacherScope ? [] : invoices.rows,
        },
      });
      return;
    }

    if (req.method === "DELETE") {
      const removed = await withTransaction(async (client) => {
        const parent = await client.query<{ id: string }>(
          `SELECT id FROM parent_accounts WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
          [id, user!.tenantId],
        );
        if (!parent.rows[0]) throw new AppError(404, "PARENT_NOT_FOUND", "Parent not found.");

        const assets = await client.query<{
          publicId: string;
          mimeType: string;
        }>(
          `SELECT d.public_id AS "publicId",d.mime_type AS "mimeType"
           FROM application_documents d
           JOIN applications a ON a.id=d.application_id
           WHERE a.parent_account_id=$1 AND a.tenant_id=$2`,
          [id, user!.tenantId],
        );
        const counts = await client.query<{
          children: number;
          applications: number;
        }>(
          `SELECT
             (SELECT count(*)::int FROM students WHERE parent_account_id=$1 AND tenant_id=$2) AS children,
             (SELECT count(*)::int FROM applications WHERE parent_account_id=$1 AND tenant_id=$2) AS applications`,
          [id, user!.tenantId],
        );

        // Rows that deliberately use ON DELETE SET NULL are explicitly removed
        // here so no mobile-app history remains attached to the deleted family.
        await client.query(
          `DELETE FROM shop_orders WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM deregistration_requests WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM students WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM applications WHERE parent_account_id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `DELETE FROM parent_accounts WHERE id=$1 AND tenant_id=$2`,
          [id, user!.tenantId],
        );
        await client.query(
          `INSERT INTO audit_log (tenant_id,actor_id,action,entity_type,metadata)
           VALUES ($1,$2,'Permanently deleted mobile parent account','parent_account',$3::jsonb)`,
          [
            user!.tenantId,
            user!.id,
            JSON.stringify({
              removedParentId: id,
              removedChildren: counts.rows[0]?.children ?? 0,
              removedApplications: counts.rows[0]?.applications ?? 0,
            }),
          ],
        );
        return {
          id,
          children: counts.rows[0]?.children ?? 0,
          applications: counts.rows[0]?.applications ?? 0,
          assets: assets.rows,
        };
      });

      // Database deletion is authoritative. Clean Cloudinary assets afterwards
      // so a temporary provider outage cannot restore app access or records.
      if (removed.assets.length) {
        try {
          const cloudinary = cloudinaryClient();
          await Promise.allSettled(
            removed.assets.map((asset) =>
              cloudinary.uploader.destroy(asset.publicId, {
                invalidate: true,
                resource_type: asset.mimeType.startsWith("image/") ? "image" : "raw",
              }),
            ),
          );
        } catch (error) {
          console.error("Parent data was deleted, but Cloudinary cleanup could not start", error);
        }
      }

      res.status(200).json({
        ok: true,
        data: [{ id: removed.id, children: removed.children, applications: removed.applications }],
      });
      return;
    }

    const input = adminParentSchema.parse(req.body);
    const branch = await query<{ id: string }>(
      "SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 AND status <> 'INACTIVE'",
      [input.branchId, user!.tenantId],
    );
    if (!branch.rows[0]) throw new AppError(422, "INVALID_BRANCH", "Select an active campus.");

    const result = await query<ParentRow>(
      `UPDATE parent_accounts
       SET name=$3,email=$4,phone=$5,preferred_branch_id=$6,updated_at=now()
       WHERE id=$1 AND tenant_id=$2
       RETURNING id,email::text,name,phone,preferred_branch_id AS "branchId",
         is_active AS "isActive",created_at::text AS "createdAt"`,
      [id, user!.tenantId, input.name, input.email, input.phone, input.branchId],
    );
    if (!result.rows[0]) throw new AppError(404, "PARENT_NOT_FOUND", "Parent not found.");
    res.status(200).json({ ok: true, data: result.rows });
  },
);
