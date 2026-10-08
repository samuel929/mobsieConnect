import { apiHandler } from "@/server/api";
import { query } from "@/server/db";

type ParentStats = { totalParents:number; newThisMonth:number; appAdoptionPercent:number; accountsInArrears:number; averageRating:number|null; ratingCount:number };

export default apiHandler<ParentStats>({ methods:["GET"], roles:["PRINCIPAL"] }, async (_req,res,{user}) => {
  const result=await query<ParentStats>(`SELECT
    COUNT(*) FILTER (WHERE p.is_active)::int AS "totalParents",
    COUNT(*) FILTER (WHERE p.is_active AND p.created_at>=date_trunc('month',now()))::int AS "newThisMonth",
    CASE WHEN COUNT(*) FILTER (WHERE p.is_active)=0 THEN 0 ELSE ROUND(100.0*COUNT(DISTINCT p.id) FILTER (
      WHERE p.is_active AND EXISTS(SELECT 1 FROM mobile_push_tokens t WHERE t.parent_account_id=p.id AND t.is_active=true)
    )/COUNT(*) FILTER (WHERE p.is_active))::int END AS "appAdoptionPercent",
    0::int AS "accountsInArrears",
    (SELECT ROUND(AVG(f.rating)::numeric,1) FROM parent_feedback f WHERE f.tenant_id=$1 AND f.rating IS NOT NULL)::float8 AS "averageRating",
    (SELECT COUNT(*)::int FROM parent_feedback f WHERE f.tenant_id=$1 AND f.rating IS NOT NULL) AS "ratingCount"
    FROM parent_accounts p WHERE p.tenant_id=$1`,[user!.tenantId]);
  res.status(200).json({ok:true,data:result.rows[0]});
});
