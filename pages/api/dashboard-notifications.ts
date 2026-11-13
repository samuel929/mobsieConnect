import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";

const readSchema=z.object({keys:z.array(z.string().min(1).max(300)).max(100)});
type Item={key:string;title:string;subtitle:string;route:string;icon:string;createdAt:string;read:boolean};

export default apiHandler<Item[]>({methods:["GET","PATCH"],roles:["PRINCIPAL","TEACHER"]},async(req,res,{user})=>{
  if(req.method==="PATCH"){
    const input=readSchema.parse(req.body);
    if(input.keys.length) await query(
      `INSERT INTO dashboard_notification_reads(user_id,notification_key)
       SELECT $1,unnest($2::text[]) ON CONFLICT(user_id,notification_key) DO NOTHING`,
      [user!.id,input.keys],
    );
    res.status(200).json({ok:true,data:[]});return;
  }
  const result=await query<Omit<Item,"read"> & {readAt:string|null}>(
    `WITH items AS (
       SELECT 'application:'||a.id AS key,'Application awaiting review' AS title,
         a.child_name||' · '||a.reference AS subtitle,'applications' AS route,'applications' AS icon,
         COALESCE(a.submitted_at,a.created_at) AS created_at
       FROM applications a LEFT JOIN application_preferences ap ON ap.application_id=a.id
       WHERE a.tenant_id=$1 AND a.status='PENDING_REVIEW'
         AND ($3::text='PRINCIPAL' OR ap.branch_id=$4::uuid)
       UNION ALL
       SELECT 'payment:'||p.id,'Payment needs attention',a.reference||' · '||COALESCE(p.status,'FAILED'),
         'payments','alert',COALESCE(p.updated_at,p.created_at)
       FROM application_payments p JOIN applications a ON a.id=p.application_id
       LEFT JOIN application_preferences ap ON ap.application_id=a.id
       WHERE a.tenant_id=$1 AND lower(p.status) IN ('failed','cancelled')
         AND ($3::text='PRINCIPAL' OR ap.branch_id=$4::uuid)
       UNION ALL
       SELECT 'invoice:'||i.id,'Invoice is overdue',i.invoice_number||' · '||p.name,
         'invoices','invoices',i.due_on::timestamptz
       FROM invoices i JOIN parent_accounts p ON p.id=i.parent_account_id
       WHERE i.tenant_id=$1 AND i.status='DUE' AND i.due_on<current_date
         AND ($3::text='PRINCIPAL' OR i.branch_id=$4::uuid)
     )
     SELECT items.key,items.title,items.subtitle,items.route,items.icon,items.created_at::text AS "createdAt",r.read_at::text AS "readAt"
     FROM items LEFT JOIN dashboard_notification_reads r ON r.user_id=$2 AND r.notification_key=items.key
     ORDER BY items.created_at DESC LIMIT 100`,
    [user!.tenantId,user!.id,user!.role,user!.branchId],
  );
  res.status(200).json({ok:true,data:result.rows.map(item=>({...item,read:Boolean(item.readAt)}))});
});
