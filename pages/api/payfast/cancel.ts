import type { NextApiRequest,NextApiResponse } from "next";
import { query } from "@/server/db";
export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const payment=Array.isArray(req.query.payment)?req.query.payment[0]:req.query.payment;
  const updated=payment?await query<{return_url:string|null}>("UPDATE application_payments SET status='CANCELLED',updated_at=now() WHERE id=$1 AND status<>'COMPLETE' RETURNING return_url",[payment]):null;
  const base=(updated?.rows[0]?.return_url||"mobsieconnect://payment/return").replace(/payment\/return(?:\/)?$/,"payment/cancel");
  const separator=base.includes("?")?"&":"?";
  const target=`${base}${separator}payment=${encodeURIComponent(payment||"")}`;
  const encoded=JSON.stringify(target).replace(/</g,"\\u003c");
  const escaped=target.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Payment cancelled</title></head><body style="margin:0;background:#f8f4ec;color:#173f36;font-family:Arial,sans-serif"><main style="max-width:520px;margin:48px auto;padding:32px;text-align:center"><h1>Payment cancelled</h1><p>No payment was recorded. Return to Mobsie Connect when you are ready.</p><a href="${escaped}" style="display:inline-block;margin-top:18px;padding:15px 24px;border-radius:14px;background:#008d85;color:#fff;text-decoration:none;font-weight:700">Return to Mobsie Connect</a></main><script>setTimeout(function(){window.location.href=${encoded}},250)</script></body></html>`);
}
