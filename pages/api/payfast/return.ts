import type { NextApiRequest,NextApiResponse } from "next";
import { query } from "@/server/db";
import { payFastConfig } from "@/server/payfast";

function html(target:string){
  const encoded=JSON.stringify(target).replace(/</g,"\\u003c");
  const escaped=target.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Payment received</title></head><body style="margin:0;background:#f8f4ec;color:#173f36;font-family:Arial,sans-serif"><main style="max-width:520px;margin:48px auto;padding:32px;text-align:center"><h1>Payment received</h1><p>Return to Mobsie Connect to confirm your payment and continue the application.</p><a href="${escaped}" style="display:inline-block;margin-top:18px;padding:15px 24px;border-radius:14px;background:#008d85;color:#fff;text-decoration:none;font-weight:700">Return to Mobsie Connect</a><p style="margin-top:22px;color:#68756f;font-size:14px">If the app does not open automatically, tap the button above.</p></main><script>setTimeout(function(){window.location.href=${encoded}},250)</script></body></html>`;
}

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const payment=Array.isArray(req.query.payment)?req.query.payment[0]:req.query.payment;
  const config=payFastConfig();
  // PayFast's sandbox can complete the browser flow without delivering its ITN
  // callback. Reconcile only sandbox payments on PayFast's success redirect so
  // testers are not left at PENDING. Live payments remain ITN-only and continue
  // to require the signed, server-to-server verification in /payfast/notify.
  if(payment&&config.sandbox){
    await query(`UPDATE application_payments SET
          status='COMPLETE',
          payment_method=COALESCE(payment_method,'SANDBOX_TEST'),
          amount_gross_cents=COALESCE(amount_gross_cents,amount_cents),
          amount_fee_cents=COALESCE(amount_fee_cents,0),
          amount_net_cents=COALESCE(amount_net_cents,amount_cents),
          paid_at=COALESCE(paid_at,now()),
          updated_at=now()
        WHERE id=$1 AND status IN ('CREATED','PENDING')`,[payment]);
  }
  const result=payment?await query<{return_url:string|null}>("SELECT return_url FROM application_payments WHERE id=$1",[payment]):null;
  const base=result?.rows[0]?.return_url||"mobsieconnect://payment/return";
  const separator=base.includes("?")?"&":"?";
  const target=`${base}${separator}payment=${encodeURIComponent(payment||"")}`;
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.status(200).send(html(target));
}
