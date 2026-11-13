import { z } from "zod";
import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { requireDashboardPermission } from "@/server/auth";
import { createAndSendNotification } from "@/server/expoPush";

const schema=z.object({action:z.enum(["MARK_PAID","RESEND"])});
export default apiHandler<Record<string,unknown>>({methods:["PATCH"],roles:["PRINCIPAL"]},async(req,res,{user})=>{
  await requireDashboardPermission(user!,"Finance");
  const id=z.string().uuid().parse(one(req.query.id));
  const input=schema.parse(req.body);
  const found=await query<{id:string;number:string;parentId:string;branchId:string|null;description:string;amountCents:number;status:string}>(
    `SELECT id,invoice_number AS number,parent_account_id AS "parentId",branch_id AS "branchId",description,amount_cents AS "amountCents",status
     FROM invoices WHERE id=$1 AND tenant_id=$2`,[id,user!.tenantId]);
  const invoice=found.rows[0];
  if(!invoice) throw new AppError(404,"INVOICE_NOT_FOUND","The invoice no longer exists.");
  if(input.action==="MARK_PAID"){
    if(invoice.status==="CANCELLED") throw new AppError(409,"INVOICE_CANCELLED","A cancelled invoice cannot be marked paid.");
    await query("UPDATE invoices SET status='PAID',paid_at=COALESCE(paid_at,now()) WHERE id=$1",[id]);
  }else{
    await createAndSendNotification({tenantId:user!.tenantId,parentAccountId:invoice.parentId,branchId:invoice.branchId,
      title:`Invoice reminder: ${invoice.number}`,body:`${invoice.description} — R ${(invoice.amountCents/100).toFixed(2)}`,
      data:{screen:"Notifications",invoiceId:invoice.id}});
  }
  res.status(200).json({ok:true,data:{id,action:input.action}});
});
