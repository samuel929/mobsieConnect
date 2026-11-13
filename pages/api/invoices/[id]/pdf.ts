import { z } from "zod";
import { apiHandler, one } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { requireDashboardPermission } from "@/server/auth";
import { textPdf } from "@/server/simplePdf";

export default apiHandler<never>({methods:["GET"],roles:["PRINCIPAL"]},async(req,res,{user})=>{
  await requireDashboardPermission(user!,"Finance");
  const id=z.string().uuid().parse(one(req.query.id));
  const result=await query<{number:string;parent:string;email:string;branch:string|null;description:string;amountCents:number;issuedOn:string;dueOn:string;status:string}>(
    `SELECT i.invoice_number AS number,p.name AS parent,p.email::text AS email,b.name AS branch,i.description,
      i.amount_cents AS "amountCents",i.issued_on::text AS "issuedOn",i.due_on::text AS "dueOn",
      CASE WHEN i.status='DUE' AND i.due_on<current_date THEN 'OVERDUE' ELSE i.status END AS status
     FROM invoices i JOIN parent_accounts p ON p.id=i.parent_account_id LEFT JOIN branches b ON b.id=i.branch_id
     WHERE i.id=$1 AND i.tenant_id=$2`,[id,user!.tenantId]);
  const invoice=result.rows[0];
  if(!invoice) throw new AppError(404,"INVOICE_NOT_FOUND","The invoice no longer exists.");
  const money=`R ${(invoice.amountCents/100).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const pdf=textPdf(`Mobsie Connect - Invoice ${invoice.number}`,["",`Billed to: ${invoice.parent}`,`Email: ${invoice.email}`,`Campus: ${invoice.branch??"Not assigned"}`,"",`Description: ${invoice.description}`,`Amount: ${money}`,`Issued: ${invoice.issuedOn}`,`Due: ${invoice.dueOn}`,`Status: ${invoice.status}`,"",`Total due: ${money}`]);
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="${invoice.number}.pdf"`);
  res.status(200).end(pdf);
});
