import { randomUUID } from "crypto";
import { apiHandler, one } from "@/server/api";
import { requireApplicationAccess } from "@/server/applicationAccess";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { payFastConfig } from "@/server/payfast";
import { schoolPrice, type SchoolStage, type SchoolType } from "@/server/schoolPackages";

type ApplicationPayment = { id:string; reference:string; applicationType:string; schoolType:SchoolType; schoolStage:SchoolStage; branchName:string; status:string|null };

export default apiHandler<unknown>({ methods:["GET","POST"], auth:false }, async(req,res)=>{
  const applicationId=one(req.query.id);
  if(!applicationId) throw new AppError(400,"APPLICATION_ID_REQUIRED","Application ID is required.");
  await requireApplicationAccess(req,applicationId);
  if(req.method==="GET"){
    const config=payFastConfig();
    if(config.sandbox){
      // Sandbox ITNs are occasionally omitted after a successful browser
      // checkout. Recover an older pending test payment when the app explicitly
      // checks its status. This fallback is never enabled for live payments.
      await query(`UPDATE application_payments SET
        status='COMPLETE',
        payment_method=COALESCE(payment_method,'SANDBOX_TEST'),
        amount_gross_cents=COALESCE(amount_gross_cents,amount_cents),
        amount_fee_cents=COALESCE(amount_fee_cents,0),
        amount_net_cents=COALESCE(amount_net_cents,amount_cents),
        paid_at=COALESCE(paid_at,now()),
        updated_at=now()
        WHERE id=(SELECT id FROM application_payments
          WHERE application_id=$1 AND status='PENDING'
            AND updated_at < now()-interval '30 seconds'
          ORDER BY created_at DESC LIMIT 1)`,[applicationId]);
    }
    const result=await query(`SELECT status,pf_payment_id AS "payFastPaymentId",amount_cents AS "amountCents",paid_at::text AS "paidAt"
      FROM application_payments WHERE application_id=$1 ORDER BY created_at DESC LIMIT 1`,[applicationId]);
    res.status(200).json({ok:true,data:result.rows[0]??{status:"NOT_STARTED"}});return;
  }
  const application=await query<ApplicationPayment>(`SELECT a.id,a.reference,a.application_type AS "applicationType",p.school_type AS "schoolType",p.school_stage AS "schoolStage",b.name AS "branchName",
    (SELECT status FROM application_payments x WHERE x.application_id=a.id ORDER BY x.created_at DESC LIMIT 1) AS status
    FROM applications a JOIN application_preferences p ON p.application_id=a.id JOIN branches b ON b.id=p.branch_id WHERE a.id=$1`,[applicationId]);
  const row=application.rows[0];
  if(!row) throw new AppError(422,"PREFERENCES_REQUIRED","Save school preferences before paying.");
  if(row.applicationType==="REREGISTRATION") throw new AppError(422,"PAYMENT_NOT_REQUIRED","Re-registration does not require an application fee.");
  if(row.status==="COMPLETE") throw new AppError(409,"ALREADY_PAID","This application fee has already been paid.");
  const amountCents=schoolPrice(row.schoolType,row.schoolStage,row.branchName).applicationFeeCents;
  const merchantPaymentId=`${row.reference}-${randomUUID().slice(0,8)}`;
  const requestedReturnUrl=typeof req.body?.returnUrl==="string"?req.body.returnUrl.trim():"";
  const returnUrl=/^(mobsieconnect|exp|exps):\/\//i.test(requestedReturnUrl)
    ? requestedReturnUrl
    : "mobsieconnect://payment/return";
  const saved=await query<{id:string}>(`INSERT INTO application_payments(application_id,merchant_payment_id,amount_cents,status,return_url)
    VALUES($1,$2,$3,'CREATED',$4) RETURNING id`,[applicationId,merchantPaymentId,amountCents,returnUrl]);
  const config=payFastConfig();
  res.status(201).json({ok:true,data:{status:"CREATED",amountCents,checkoutUrl:`${config.appUrl}/api/payfast/checkout/?payment=${saved.rows[0].id}`}});
});
