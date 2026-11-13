import { z } from "zod";
import { randomUUID } from "crypto";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { requireDashboardPermission } from "@/server/auth";
import { createAndSendNotification } from "@/server/expoPush";

const createSchema=z.object({
  parentAccountId:z.string().uuid(),
  description:z.string().trim().min(2).max(500),
  amount:z.coerce.number().positive().max(1_000_000),
  dueOn:z.iso.date(),
});

const invoiceSelect=`SELECT i.id,i.invoice_number AS "invoiceNumber",i.parent_account_id AS "parentAccountId",
  p.name AS "parentName",p.email::text AS "parentEmail",i.branch_id AS "branchId",b.name AS "branchName",
  i.description,i.amount_cents AS "amountCents",i.issued_on::text AS "issuedOn",i.due_on::text AS "dueOn",
  CASE WHEN i.status='DUE' AND i.due_on<current_date THEN 'OVERDUE' ELSE i.status END AS status,
  i.paid_at::text AS "paidAt",i.created_at::text AS "createdAt"
  FROM invoices i JOIN parent_accounts p ON p.id=i.parent_account_id LEFT JOIN branches b ON b.id=i.branch_id`;

export default apiHandler<Record<string,unknown>[]>({methods:["GET","POST"],roles:["PRINCIPAL"]},async(req,res,{user})=>{
  await requireDashboardPermission(user!,"Finance");
  if(req.method==="POST"){
    const input=createSchema.parse(req.body);
    const parent=await query<{id:string;branchId:string|null}>(
      `SELECT id,preferred_branch_id AS "branchId" FROM parent_accounts
       WHERE id=$1 AND tenant_id=$2 AND is_active=true LIMIT 1`,
      [input.parentAccountId,user!.tenantId],
    );
    if(!parent.rows[0]) throw new AppError(422,"PARENT_NOT_FOUND","Select an active parent account.");
    const today=new Date().toISOString().slice(0,10);
    if(input.dueOn<today) throw new AppError(422,"INVALID_DUE_DATE","The due date cannot be in the past.");
    const invoiceNumber=`INV-${new Date().getFullYear()}-${randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`;
    const saved=await query<Record<string,unknown>>(
      `INSERT INTO invoices(tenant_id,parent_account_id,branch_id,invoice_number,description,amount_cents,due_on,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [user!.tenantId,input.parentAccountId,parent.rows[0].branchId,invoiceNumber,input.description,Math.round(input.amount*100),input.dueOn,user!.id],
    );
    await createAndSendNotification({tenantId:user!.tenantId,parentAccountId:input.parentAccountId,branchId:parent.rows[0].branchId,
      title:"A new invoice has been sent to your app",body:`Invoice ${invoiceNumber}: ${input.description} — R ${input.amount.toFixed(2)}`,
      sourceType:"INVOICE",sourceId:String(saved.rows[0].id),data:{screen:"Notifications",invoiceId:saved.rows[0].id}});
    const row=await query<Record<string,unknown>>(`${invoiceSelect} WHERE i.id=$1 AND i.tenant_id=$2`,[saved.rows[0].id,user!.tenantId]);
    res.status(201).json({ok:true,data:row.rows});return;
  }
  const rows=await query<Record<string,unknown>>(`${invoiceSelect} WHERE i.tenant_id=$1 ORDER BY i.created_at DESC`,[user!.tenantId]);
  res.status(200).json({ok:true,data:rows.rows});
});
