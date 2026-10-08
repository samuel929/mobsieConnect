import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/server/db";
import { sendExpoPush } from "@/server/expoPush";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if(req.method!=="POST"&&req.method!=="GET") return res.status(405).end();
  if(process.env.CRON_SECRET && req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ok:false});
  const due=await query<{id:string;tenantId:string;branchId:string|null;title:string;body:string;data:Record<string,unknown>}>(`UPDATE mobile_notifications SET status='SENDING'
    WHERE id IN (SELECT id FROM mobile_notifications WHERE status='SCHEDULED' AND scheduled_at<=now() ORDER BY scheduled_at LIMIT 100 FOR UPDATE SKIP LOCKED)
    RETURNING id,tenant_id AS "tenantId",branch_id AS "branchId",title,body,data`);
  let sent=0,failed=0;
  for(const item of due.rows){try{const result=await sendExpoPush(item);sent+=result.sent;failed+=result.failed;await query("UPDATE mobile_notifications SET status='SENT',sent_at=now() WHERE id=$1",[item.id]);}catch(error){failed++;await query("UPDATE mobile_notifications SET status='FAILED' WHERE id=$1",[item.id]);}}
  res.status(200).json({ok:true,data:{processed:due.rows.length,sent,failed}});
}
