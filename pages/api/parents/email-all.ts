import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { sendParentBroadcastEmail } from "@/server/admissionsMailer";

const schema=z.object({subject:z.string().trim().min(2).max(180),body:z.string().trim().min(2).max(10000),branchId:z.uuid().nullable().optional()});
export default apiHandler<{sent:number}>({methods:["POST"],roles:["PRINCIPAL"]},async(req,res,{user})=>{
  const input=schema.parse(req.body);
  const recipients=await query<{email:string}>(`SELECT DISTINCT p.email::text AS email FROM parent_accounts p
    WHERE p.tenant_id=$1 AND p.is_active=true AND ($2::uuid IS NULL OR p.preferred_branch_id=$2 OR EXISTS(
      SELECT 1 FROM students s WHERE s.parent_account_id=p.id AND s.branch_id=$2)) ORDER BY email`,[user!.tenantId,input.branchId??null]);
  if(!recipients.rows.length) throw new AppError(422,"NO_RECIPIENTS","No active parents match this audience.");
  await sendParentBroadcastEmail({recipients:recipients.rows.map(row=>row.email),subject:input.subject,body:input.body});
  res.status(200).json({ok:true,data:{sent:recipients.rows.length}});
});
