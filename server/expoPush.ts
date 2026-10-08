import { query } from "./db";

type Token = { token: string };
type Ticket = { status: "ok" | "error"; details?: { error?: string } };

export async function sendExpoPush(input: { tenantId:string; branchId?:string|null; title:string; body:string; data?:Record<string,unknown> }) {
  const tokens=await query<Token>(`SELECT t.expo_push_token AS token FROM mobile_push_tokens t
    JOIN parent_accounts p ON p.id=t.parent_account_id
    WHERE t.tenant_id=$1 AND t.is_active=true AND p.is_active=true
      AND ($2::uuid IS NULL OR p.preferred_branch_id=$2 OR EXISTS(
        SELECT 1 FROM students s WHERE s.parent_account_id=p.id AND s.branch_id=$2))`,[input.tenantId,input.branchId??null]);
  let sent=0,failed=0;
  for(let i=0;i<tokens.rows.length;i+=100){
    const batch=tokens.rows.slice(i,i+100);
    const response=await fetch("https://exp.host/--/api/v2/push/send",{
      method:"POST",
      headers:{Accept:"application/json","Content-Type":"application/json"},
      body:JSON.stringify(batch.map(({token})=>({
        to:token,
        sound:"default",
        title:input.title,
        body:input.body,
        data:input.data??{screen:"Notifications"},
      }))),
    });
    if(!response.ok) throw new Error(`Expo push service returned ${response.status}.`);
    const tickets=((await response.json()) as {data?:Ticket[]}).data??[];
    sent+=tickets.filter(t=>t.status==="ok").length; failed+=tickets.filter(t=>t.status!=="ok").length;
    const invalid=tickets.map((t,index)=>t.details?.error==="DeviceNotRegistered"?batch[index]?.token:null).filter((value):value is string=>Boolean(value));
    if(invalid.length) await query("UPDATE mobile_push_tokens SET is_active=false,last_error='DeviceNotRegistered',updated_at=now() WHERE tenant_id=$1 AND expo_push_token=ANY($2::text[])",[input.tenantId,invalid]);
  }
  return {sent,failed};
}

export async function createAndSendNotification(input:{tenantId:string;branchId?:string|null;title:string;body:string;audience?:string;data?:Record<string,unknown>;sourceType?:string;sourceId?:string;scheduledAt?:string|null}){
  const scheduled=input.scheduledAt&&new Date(input.scheduledAt)>new Date();
  const row=await query<{id:string}>(`INSERT INTO mobile_notifications
    (tenant_id,branch_id,title,body,audience,data,scheduled_at,status,source_type,source_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (tenant_id,source_type,source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO UPDATE SET title=EXCLUDED.title
    RETURNING id`,[input.tenantId,input.branchId??null,input.title,input.body,input.audience??"All campuses",JSON.stringify(input.data??{}),input.scheduledAt??null,scheduled?"SCHEDULED":"SENDING",input.sourceType??null,input.sourceId??null]);
  await query(
    `INSERT INTO mobile_notification_deliveries (notification_id,parent_account_id)
     SELECT $1,p.id FROM parent_accounts p
     WHERE p.tenant_id=$2 AND p.is_active=true
       AND ($3::uuid IS NULL OR p.preferred_branch_id=$3 OR EXISTS(
         SELECT 1 FROM students s WHERE s.parent_account_id=p.id AND s.branch_id=$3))
       AND NOT EXISTS (
         SELECT 1 FROM mobile_notification_deliveries d
         WHERE d.notification_id=$1 AND d.parent_account_id=p.id)
     ON CONFLICT DO NOTHING`,
    [row.rows[0].id,input.tenantId,input.branchId??null],
  );
  if(scheduled) return {id:row.rows[0].id,sent:0,failed:0,scheduled:true};
  const delivery=await sendExpoPush(input);
  await query("UPDATE mobile_notifications SET status='SENT',sent_at=now() WHERE id=$1",[row.rows[0].id]);
  return {id:row.rows[0].id,...delivery,scheduled:false};
}
