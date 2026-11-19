import { z } from "zod";
import { apiHandler } from "@/server/api";
import { applicationReference, nextAvailableReference } from "@/server/applicationReference";
import { getParent } from "@/server/parentAuth";
import { query, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";

const schema = z.object({
  studentId: z.uuid(),
  toBranchId: z.uuid(),
  reason: z.string().trim().max(1000).optional(),
});

export default apiHandler<unknown>({ methods: ["GET", "POST"], auth: false }, async (req, res) => {
  const parent = await getParent(req);
  if (req.method === "GET") {
    const rows = await query(`SELECT r.id,r.student_id AS "studentId",fb.name AS "fromBranch",tb.name AS "toBranch",
      r.old_reference AS "oldReference",r.new_reference AS "newReference",r.status,r.created_at::text AS "createdAt"
      FROM branch_transfer_requests r JOIN branches fb ON fb.id=r.from_branch_id JOIN branches tb ON tb.id=r.to_branch_id
      WHERE r.tenant_id=$1 AND r.parent_account_id=$2 ORDER BY r.created_at DESC`, [parent.tenantId, parent.id]);
    res.status(200).json({ ok: true, data: rows.rows }); return;
  }
  const input = schema.parse(req.body);
  const result = await withTransaction(async (client) => {
    const studentResult = await client.query<{ id:string; branchId:string; applicationId:string|null; reference:string|null; name:string; dateOfBirth:string }>(
      `SELECT s.id,s.branch_id AS "branchId",s.application_id AS "applicationId",a.reference,
              s.name,s.date_of_birth::text AS "dateOfBirth"
       FROM students s LEFT JOIN applications a ON a.id=s.application_id
       WHERE s.id=$1 AND s.tenant_id=$2 AND (s.parent_account_id=$3 OR a.parent_account_id=$3) LIMIT 1`,
      [input.studentId,parent.tenantId,parent.id],
    );
    const student=studentResult.rows[0];
    if(!student) throw new AppError(404,"STUDENT_NOT_FOUND","That enrolled child was not found.");
    if(student.branchId===input.toBranchId) throw new AppError(422,"SAME_BRANCH","Select a different branch.");
    const branch=await client.query<{name:string}>("SELECT name FROM branches WHERE id=$1 AND tenant_id=$2 AND status='ACTIVE'",[input.toBranchId,parent.tenantId]);
    if(!branch.rows[0]) throw new AppError(422,"BRANCH_NOT_FOUND","The selected branch is unavailable.");
    const baseReference=applicationReference(branch.rows[0].name,student.name,student.dateOfBirth);
    const matches=await client.query<{reference:string}>(
      `SELECT reference FROM applications
       WHERE tenant_id=$1 AND ($2::uuid IS NULL OR id<>$2)
         AND (reference=$3 OR reference LIKE $3||'-%')`,
      [parent.tenantId,student.applicationId,baseReference],
    );
    const newReference=nextAvailableReference(baseReference,matches.rows.map((row)=>row.reference));
    await client.query("UPDATE students SET branch_id=$2,updated_at=now() WHERE id=$1",[student.id,input.toBranchId]);
    if(student.applicationId){
      await client.query("UPDATE application_preferences SET branch_id=$2,updated_at=now() WHERE application_id=$1",[student.applicationId,input.toBranchId]);
      await client.query("UPDATE applications SET reference=$2,updated_at=now() WHERE id=$1",[student.applicationId,newReference]);
    }
    return client.query(`INSERT INTO branch_transfer_requests
      (tenant_id,parent_account_id,student_id,from_branch_id,to_branch_id,old_reference,new_reference,reason,status,completed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'COMPLETED',now()) RETURNING id,new_reference AS "newReference",status`,
      [parent.tenantId,parent.id,student.id,student.branchId,input.toBranchId,student.reference,newReference,input.reason??null]);
  });
  res.status(201).json({ok:true,data:result.rows[0]});
});
