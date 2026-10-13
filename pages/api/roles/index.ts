import { z } from "zod";

import { apiHandler } from "@/server/api";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";

export const PERMISSIONS = [
  "View dashboard","Manage school profile","Manage campuses","Manage learners",
  "Manage teachers","Admissions","Finance","Communications","Media & gallery",
  "Reports & analytics","User management","Platform settings",
] as const;

const defaults: Array<[string,string,number[]]> = [
  ["Super Admin","#F97316",[1,1,1,1,1,1,1,1,1,1,1,1]],
  ["School Owner","#7C3AED",[1,1,1,1,1,1,1,1,1,1,1,0]],
  ["Branch Principal","#2563EB",[1,0,0,1,1,1,0,1,1,1,0,0]],
  ["Finance Manager","#16A34A",[1,0,0,0,0,0,1,0,0,1,0,0]],
  ["Admissions","#0D9488",[1,0,0,1,0,1,0,1,0,0,0,0]],
  ["Teacher","#D97706",[1,0,0,1,0,0,0,1,1,0,0,0]],
];

async function ensureRoles(tenantId: string) {
  await withTransaction(async (client) => {
    for (const [name,color,grants] of defaults) {
      const role=await client.query<{id:string}>(`INSERT INTO dashboard_roles(tenant_id,name,color,is_system) VALUES($1,$2,$3,true)
        ON CONFLICT(tenant_id,name) DO UPDATE SET color=EXCLUDED.color RETURNING id`,[tenantId,name,color]);
      for(let index=0;index<PERMISSIONS.length;index+=1){
        await client.query(`INSERT INTO dashboard_role_permissions(role_id,permission_key,granted) VALUES($1,$2,$3)
          ON CONFLICT(role_id,permission_key) DO NOTHING`,[role.rows[0].id,PERMISSIONS[index],Boolean(grants[index])]);
      }
    }
  });
}

const createSchema=z.object({name:z.string().trim().min(2).max(80),baseRoleId:z.uuid()});
const updateSchema=z.object({roleId:z.uuid(),permission:z.enum(PERMISSIONS),granted:z.boolean()});

export default apiHandler<unknown>({methods:["GET","POST","PUT"],roles:["PRINCIPAL","TEACHER"]},async(req,res,{user})=>{
  const principal=user!;
  await ensureRoles(principal.tenantId);
  if(req.method==="POST"){
    if(principal.role!=="PRINCIPAL")throw new AppError(403,"FORBIDDEN","Only principals can create roles.");
    const input=createSchema.parse(req.body);
    const base=await query<{id:string}>("SELECT id FROM dashboard_roles WHERE id=$1 AND tenant_id=$2",[input.baseRoleId,principal.tenantId]);
    if(!base.rows[0])throw new AppError(404,"ROLE_NOT_FOUND","The starting role no longer exists.");
    const created=await query<{id:string}>(`INSERT INTO dashboard_roles(tenant_id,name) VALUES($1,$2) RETURNING id`,[principal.tenantId,input.name]);
    await query(`INSERT INTO dashboard_role_permissions(role_id,permission_key,granted)
      SELECT $1,permission_key,granted FROM dashboard_role_permissions WHERE role_id=$2`,[created.rows[0].id,input.baseRoleId]);
    res.status(201).json({ok:true,data:{id:created.rows[0].id}});return;
  }
  if(req.method==="PUT"){
    if(principal.role!=="PRINCIPAL")throw new AppError(403,"FORBIDDEN","Only principals can change permissions.");
    const input=updateSchema.parse(req.body);
    const role=await query("SELECT 1 FROM dashboard_roles WHERE id=$1 AND tenant_id=$2",[input.roleId,principal.tenantId]);
    if(!role.rows[0])throw new AppError(404,"ROLE_NOT_FOUND","That role no longer exists.");
    await query(`INSERT INTO dashboard_role_permissions(role_id,permission_key,granted) VALUES($1,$2,$3)
      ON CONFLICT(role_id,permission_key) DO UPDATE SET granted=EXCLUDED.granted,updated_at=now()`,[input.roleId,input.permission,input.granted]);
    res.status(200).json({ok:true,data:{...input}});return;
  }
  const roles=await query<{id:string;name:string;color:string;isSystem:boolean;users:number;permissions:string[]}>(`SELECT r.id,r.name,r.color,r.is_system AS "isSystem",
    COUNT(DISTINCT ur.user_id)::int AS users,COALESCE(array_agg(DISTINCT p.permission_key) FILTER(WHERE p.granted),'{}') AS permissions
    FROM dashboard_roles r LEFT JOIN dashboard_role_permissions p ON p.role_id=r.id
    LEFT JOIN user_dashboard_roles ur ON ur.role_id=r.id WHERE r.tenant_id=$1 GROUP BY r.id ORDER BY r.is_system DESC,r.created_at`,[principal.tenantId]);
  const current=await query<{id:string;name:string;permissions:string[]}>(`SELECT r.id,r.name,COALESCE(array_agg(DISTINCT p.permission_key) FILTER(WHERE p.granted),'{}') AS permissions
    FROM user_dashboard_roles ur JOIN dashboard_roles r ON r.id=ur.role_id LEFT JOIN dashboard_role_permissions p ON p.role_id=r.id
    WHERE ur.user_id=$1 GROUP BY r.id`,[principal.id]);
  let currentRole=current.rows[0];
  if(!currentRole){
    const fallback=roles.rows.find(role=>role.name===(principal.role==="TEACHER"?"Teacher":"Super Admin"))!;
    await query(`INSERT INTO user_dashboard_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,[principal.id,fallback.id]);
    currentRole={id:fallback.id,name:fallback.name,permissions:fallback.permissions};
  }
  res.status(200).json({ok:true,data:{permissions:[...PERMISSIONS],roles:roles.rows,currentRole}});
});
