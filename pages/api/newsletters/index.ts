import { z } from "zod";
import { apiHandler } from "@/server/api";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { createAndSendNotification } from "@/server/expoPush";
import { publishRealtime } from "@/server/realtime";

const contentSchema=z.object({
  heroTitle:z.string().trim().min(2).max(180),intro:z.string().trim().min(2).max(3000),
  featureTitle:z.string().trim().max(180).optional().default(""),featureCopy:z.string().trim().max(5000).optional().default(""),
  ctaText:z.string().trim().max(80).optional().default(""),ctaLink:z.string().url().max(2000).optional().or(z.literal("")),
  headerImageUrl:z.string().url().max(2000).optional().or(z.literal("")),featureImageUrl:z.string().url().max(2000).optional().or(z.literal("")),footerImageUrl:z.string().url().max(2000).optional().or(z.literal("")),
  headerImagePublicId:z.string().trim().max(500).optional().default(""),featureImagePublicId:z.string().trim().max(500).optional().default(""),footerImagePublicId:z.string().trim().max(500).optional().default(""),
  footer:z.string().trim().max(1000).optional().default(""),
});
const schema=z.object({title:z.string().trim().min(2).max(160),body:z.string().trim().min(2).max(10000),audience:z.string().trim().default("All campuses"),branchId:z.string().uuid().nullable().optional(),status:z.enum(["DRAFT","SENT"]).default("SENT"),content:contentSchema});
export default apiHandler<Record<string,unknown>[]>({methods:["GET","POST"],roles:["PRINCIPAL"]},async(req,res,{user})=>{
  if(req.method==="POST"){
    const input=schema.parse(req.body);let branchId:string|null=null;
    if(input.audience!=="All campuses"){
      const branch=await query<{id:string;name:string}>(
        `SELECT id,name FROM branches
         WHERE tenant_id=$1
           AND (id=$2::uuid OR lower(trim(name))=lower(trim($3)))
         LIMIT 1`,
        [user!.tenantId,input.branchId??null,input.audience],
      );
      if(!branch.rows[0]) throw new AppError(422,"BRANCH_NOT_FOUND","Select a current campus before sending the newsletter.");
      branchId=branch.rows[0].id;
      input.audience=branch.rows[0].name;
    }
    const saved=await query<{id:string;publishedAt:string}>(`INSERT INTO newsletters(tenant_id,branch_id,title,body,audience,status,content,created_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id,published_at::text AS "publishedAt"`,[user!.tenantId,branchId,input.title,input.body,input.audience,input.status,JSON.stringify(input.content),user!.id]);
    if(input.status==="SENT"){
      await createAndSendNotification({tenantId:user!.tenantId,branchId,title:`New newsletter: ${input.title}`,body:"A new school newsletter is available in Mobsie Connect.",sourceType:"NEWSLETTER",sourceId:saved.rows[0].id,data:{screen:"Newsletter",newsletterId:saved.rows[0].id}});
      publishRealtime("newsletter", user!.tenantId);
    }
    res.status(201).json({ok:true,data:[{id:saved.rows[0].id,...input,publishedAt:saved.rows[0].publishedAt,status:input.status==="SENT"?"Sent":"Draft"}]});return;
  }
  const rows=await query(`SELECT id,title,body,audience,content,status,published_at::text AS "publishedAt" FROM newsletters WHERE tenant_id=$1 ORDER BY created_at DESC`,[user!.tenantId]);
  res.status(200).json({ok:true,data:rows.rows});
});
