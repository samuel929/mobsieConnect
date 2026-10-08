import type { NextApiRequest,NextApiResponse } from "next";
import { query } from "@/server/db";
import { payFastConfig,payFastSignature,type PayFastFields } from "@/server/payfast";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if(req.method!=="POST"){res.status(405).end();return;}
  const fields=Object.fromEntries(Object.entries(req.body||{}).map(([key,value])=>[key,String(value)])) as PayFastFields;
  const config=payFastConfig();
  if(fields.merchant_id!==config.merchantId||!fields.signature||payFastSignature(fields,config.passphrase)!==fields.signature){res.status(400).send('Invalid signature');return;}
  const payment=await query<any>("SELECT id,amount_cents FROM application_payments WHERE merchant_payment_id=$1",[fields.m_payment_id]);
  const row=payment.rows[0];
  if(!row||Math.abs(Number(fields.amount_gross)*100-Number(row.amount_cents))>1){res.status(400).send('Invalid amount');return;}
  const validationBody=new URLSearchParams(Object.entries(fields).filter(([key])=>key!=='signature')).toString();
  const validation=await fetch(config.validateUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:validationBody});
  const valid=(await validation.text()).trim()==='VALID';
  if(!valid){res.status(400).send('Invalid payment');return;}
  const status=fields.payment_status==='COMPLETE'?'COMPLETE':fields.payment_status==='CANCELLED'?'CANCELLED':'FAILED';
  await query(`UPDATE application_payments SET status=$2,pf_payment_id=$3,payment_payload=$4::jsonb,paid_at=CASE WHEN $2='COMPLETE' THEN now() ELSE paid_at END,updated_at=now() WHERE id=$1`,[row.id,status,fields.pf_payment_id||null,JSON.stringify(fields)]);
  res.status(200).send('OK');
}
