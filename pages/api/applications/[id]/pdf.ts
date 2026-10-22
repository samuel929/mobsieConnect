import type { NextApiResponse } from "next";
import { apiHandler, one } from "@/server/api";
import { getRequestUser, requireRole } from "@/server/auth";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

type ApplicationPdfRow = {
  id: string;
  reference: string;
  status: string;
  applicationType: string;
  submittedAt: string | null;
  createdAt: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  relationship: string;
  childName: string;
  childIdNumber: string | null;
  childDateOfBirth: string;
  childGender: string;
  currentGrade: string;
  childHasDisability: boolean;
  disabilityDetails: string | null;
  branchName: string | null;
  schoolType: string | null;
  schoolStage: string | null;
  preferredStartDate: string | null;
  enrollmentType: string | null;
  aftercareRequested: boolean;
  previousSchool: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  feePayerFirstName: string | null;
  feePayerLastName: string | null;
};

type ApplicationDocument = { kind: string; originalName: string };
type PdfLine = { text: string; size?: number; bold?: boolean; gap?: number };

function clean(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value)
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "");
}

function label(value: unknown) {
  return clean(value).replace(/_/g, " ");
}

function wrap(text: string, width = 88) {
  const words = clean(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

function escapePdf(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function makePdf(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let remaining = 735;
  for (const line of lines) {
    const height = line.gap ?? Math.max(14, (line.size ?? 10) + 5);
    if (remaining - height < 45 && page.length) {
      pages.push(page);
      page = [];
      remaining = 735;
    }
    page.push(line);
    remaining -= height;
  }
  if (page.length) pages.push(page);

  const pageIds = pages.map((_, index) => 5 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    let y = 790;
    const commands = ["BT"];
    for (const line of pageLines) {
      const size = line.size ?? 10;
      commands.push(`/${line.bold ? "F2" : "F1"} ${size} Tf`);
      commands.push(`1 0 0 1 50 ${y} Tm`);
      commands.push(`(${escapePdf(line.text)}) Tj`);
      y -= line.gap ?? Math.max(14, size + 5);
    }
    commands.push("ET");
    const stream = commands.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
  });

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%Mobsie\n", "latin1")];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(
      Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, "latin1"),
    );
  });
  const xrefOffset = Buffer.concat(chunks).length;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}\n%%EOF`,
  ].join("\n");
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

function addField(lines: PdfLine[], name: string, value: unknown) {
  const wrapped = wrap(`${name}: ${label(value)}`);
  wrapped.forEach((text, index) =>
    lines.push({ text, bold: index === 0 && text === `${name}:` }),
  );
}

export default apiHandler<unknown>(
  { methods: ["GET"], auth: false },
  async (req, res) => {
    const user = await getRequestUser(req);
    requireRole(user, ["PRINCIPAL"]);
    const identifier = one(req.query.id);
    if (!identifier)
      throw new AppError(
        400,
        "APPLICATION_ID_REQUIRED",
        "Application ID is required.",
      );

    const result = await query<ApplicationPdfRow>(
      `SELECT a.id,a.reference,a.status::text,a.application_type AS "applicationType",
              a.submitted_at::text AS "submittedAt",a.created_at::text AS "createdAt",
              a.parent_name AS "parentName",a.parent_email::text AS "parentEmail",
              a.parent_phone AS "parentPhone",a.relationship,
              a.child_name AS "childName",a.child_id_number AS "childIdNumber",a.child_date_of_birth::text AS "childDateOfBirth",
              a.child_gender AS "childGender",a.current_grade AS "currentGrade",
              a.child_has_disability AS "childHasDisability",a.disability_details AS "disabilityDetails",
              b.name AS "branchName",p.school_type AS "schoolType",p.school_stage AS "schoolStage",
              p.preferred_start_date::text AS "preferredStartDate",p.enrollment_type AS "enrollmentType",
              COALESCE((to_jsonb(p)->>'aftercare_requested')::boolean,false) AS "aftercareRequested",
              p.previous_school AS "previousSchool",p.allergies,
              p.emergency_contact_name AS "emergencyContactName",
              p.emergency_contact_phone AS "emergencyContactPhone",
              to_jsonb(p)->>'fee_payer_first_name' AS "feePayerFirstName",
              to_jsonb(p)->>'fee_payer_last_name' AS "feePayerLastName"
       FROM applications a
       LEFT JOIN application_preferences p ON p.application_id=a.id
       LEFT JOIN branches b ON b.id=p.branch_id
       WHERE a.tenant_id=$1 AND (a.id::text=$2 OR a.reference=$2)
       LIMIT 1`,
      [user.tenantId, identifier],
    );
    const application = result.rows[0];
    if (!application)
      throw new AppError(
        404,
        "APPLICATION_NOT_FOUND",
        "Application not found.",
      );

    const documents = await query<ApplicationDocument>(
      `SELECT kind,original_name AS "originalName"
       FROM application_documents WHERE application_id=$1 ORDER BY id`,
      [application.id],
    );

    const lines: PdfLine[] = [
      { text: "MOBSIE CONNECT", size: 18, bold: true, gap: 24 },
      { text: "ENROLMENT APPLICATION", size: 15, bold: true, gap: 25 },
      {
        text: `Application reference: ${clean(application.reference)}`,
        size: 11,
        bold: true,
      },
      {
        text: `Generated: ${new Date().toLocaleString("en-ZA")}`,
        size: 9,
        gap: 24,
      },
      { text: "APPLICATION STATUS", size: 12, bold: true, gap: 19 },
    ];
    addField(lines, "Status", application.status);
    addField(lines, "Application type", application.applicationType);
    addField(
      lines,
      "Submitted",
      application.submittedAt ?? application.createdAt,
    );
    lines.push({ text: "PARENT / GUARDIAN", size: 12, bold: true, gap: 19 });
    addField(lines, "Name", application.parentName);
    addField(lines, "Relationship", application.relationship);
    addField(lines, "Email", application.parentEmail);
    addField(lines, "Phone", application.parentPhone);
    lines.push({ text: "CHILD DETAILS", size: 12, bold: true, gap: 19 });
    addField(lines, "Name", application.childName);
    addField(lines, "ID number", application.childIdNumber ?? "Not supplied");
    addField(lines, "Date of birth", application.childDateOfBirth);
    addField(lines, "Gender", application.childGender);
    addField(lines, "Current grade", application.currentGrade);
    addField(
      lines,
      "Disability disclosed",
      application.childHasDisability ? "Yes" : "No",
    );
    if (application.childHasDisability)
      addField(lines, "Support details", application.disabilityDetails);
    lines.push({ text: "SCHOOL PREFERENCES", size: 12, bold: true, gap: 19 });
    addField(lines, "Preferred branch", application.branchName);
    addField(lines, "School type", application.schoolType);
    addField(lines, "Stage", application.schoolStage);
    addField(lines, "Start date", application.preferredStartDate);
    addField(lines, "Attendance", application.enrollmentType);
    addField(
      lines,
      "Aftercare",
      application.aftercareRequested ? "Requested" : "Not requested",
    );
    addField(lines, "Previous school", application.previousSchool);
    addField(lines, "Medical / allergy information", application.allergies);
    addField(
      lines,
      "Emergency contact",
      [application.emergencyContactName, application.emergencyContactPhone]
        .filter(Boolean)
        .join(" - "),
    );
    addField(
      lines,
      "Person responsible for fees",
      [application.feePayerFirstName, application.feePayerLastName]
        .filter(Boolean)
        .join(" "),
    );
    lines.push({ text: "UPLOADED DOCUMENTS", size: 12, bold: true, gap: 19 });
    if (!documents.rows.length) lines.push({ text: "No documents uploaded." });
    documents.rows.forEach((document, index) =>
      addField(
        lines,
        `${index + 1}. ${label(document.kind)}`,
        document.originalName,
      ),
    );
    lines.push({
      text: "This document was generated by Mobsie Connect.",
      size: 8,
      gap: 12,
    });

    const pdf = makePdf(lines);
    const fileName = `mobsie-application-${application.reference.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", String(pdf.length));
    (res as NextApiResponse).status(200).end(pdf);
  },
);
