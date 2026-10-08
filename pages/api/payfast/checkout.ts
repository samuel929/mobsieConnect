import type { NextApiRequest,NextApiResponse } from "next";
import { query } from "@/server/db";
import { payFastConfig,payFastForm,payFastSignature,type PayFastFields } from "@/server/payfast";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if(req.method!=="GET"){res.status(405).end();return;}
  const payment=Array.isArray(req.query.payment)?req.query.payment[0]:req.query.payment;
  const result=await query<any>(`SELECT x.id,x.merchant_payment_id,x.amount_cents,x.status,a.reference,a.parent_name,a.parent_email,a.parent_phone,a.child_name
    FROM application_payments x JOIN applications a ON a.id=x.application_id WHERE x.id=$1`,[payment]);
  const row=result.rows[0];
  if(!row||!['CREATED','PENDING'].includes(row.status)){res.status(404).send('Payment session is unavailable.');return;}
  const config=payFastConfig();
  const names=String(row.parent_name).trim().split(/\s+/);
  const fields:PayFastFields={merchant_id:config.merchantId,merchant_key:config.merchantKey,
    return_url:`${config.appUrl}/api/payfast/return/?payment=${row.id}`,cancel_url:`${config.appUrl}/api/payfast/cancel/?payment=${row.id}`,
    notify_url:`${config.appUrl}/api/payfast/notify/`,name_first:names[0]||'Parent',name_last:names.slice(1).join(' ')||'Guardian',
    email_address:row.parent_email,cell_number:row.parent_phone||'',m_payment_id:row.merchant_payment_id,
    amount:(Number(row.amount_cents)/100).toFixed(2),item_name:`Mobsie application ${row.reference}`,item_description:`Application fee for ${row.child_name}`};
  fields.signature=payFastSignature(fields,config.passphrase);
  await query("UPDATE application_payments SET status='PENDING',updated_at=now() WHERE id=$1",[row.id]);
  res.setHeader('Content-Type','text/html; charset=utf-8');res.status(200).send(payFastForm(fields,config.processUrl));
}
