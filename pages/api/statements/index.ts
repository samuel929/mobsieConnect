import { z } from "zod";
import { apiHandler, one } from "@/server/api";
import { requireDashboardPermission } from "@/server/auth";
import { getStatementRows } from "@/server/statements";

const schema=z.object({period:z.string().regex(/^\d{4}-\d{2}$/).optional()});

export default apiHandler<unknown>({methods:["GET"],roles:["PRINCIPAL"]},async(req,res,{user})=>{
  await requireDashboardPermission(user!,"Finance");
  const input=schema.parse({period:one(req.query.period)});
  const period=input.period??new Date().toISOString().slice(0,7);
  const rows=await getStatementRows(user!.tenantId,period);
  res.status(200).json({ok:true,data:{period,rows}});
});
