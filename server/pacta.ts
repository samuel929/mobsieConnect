import nodemailer from "nodemailer";

import { AppError } from "./errors";

export function consentTemplateId(formId: string) {
  const configured = process.env[`PACTA_TEMPLATE_${formId.replace(/-/g, "_").toUpperCase()}`];
  return configured || formId;
}

export async function pactaRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.PACTA_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.PACTA_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new AppError(503, "SIGNING_NOT_CONFIGURED", "Document signing is not configured.");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new AppError(502, "SIGNING_PROVIDER_ERROR", "The signing provider could not complete this request.");
  }
  return response.json() as Promise<T>;
}

type ApprovalEmail = {
  to: string;
  parentName: string;
  childName: string;
  reference: string;
  branchName?: string | null;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!host || !user || !pass || !Number.isInteger(port)) {
    throw new AppError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "Approval was saved, but email is not configured. Add the SMTP settings and try approving again.",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
  });
  return transporter;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendApplicationApprovedEmail(input: ApprovalEmail) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) {
    throw new AppError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "Approval was saved, but the email sender address is not configured.",
    );
  }

  const parentName = escapeHtml(input.parentName);
  const childName = escapeHtml(input.childName);
  const reference = escapeHtml(input.reference);
  const branch = input.branchName ? escapeHtml(input.branchName) : null;

  try {
    const result = await getTransporter().sendMail({
      from,
      to: input.to,
      subject: `Enrollment approved for ${input.childName}`,
      text: [
        `Dear ${input.parentName},`,
        "",
        `We are pleased to confirm that ${input.childName}'s enrollment application has been approved.`,
        input.branchName ? `Branch: ${input.branchName}` : "",
        `Application reference: ${input.reference}`,
        "",
        "The school will contact you with the next steps.",
        "",
        "Kind regards,",
        "Mobsie Kids",
      ].filter(Boolean).join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033;line-height:1.6">
          <div style="background:#16a34a;color:#fff;padding:24px;border-radius:14px 14px 0 0">
            <h1 style="font-size:24px;margin:0">Enrollment approved</h1>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:0;padding:28px;border-radius:0 0 14px 14px">
            <p>Dear ${parentName},</p>
            <p>We are pleased to confirm that <strong>${childName}</strong>'s enrollment application has been approved.</p>
            ${branch ? `<p><strong>Branch:</strong> ${branch}</p>` : ""}
            <p><strong>Application reference:</strong> ${reference}</p>
            <p>The school will contact you with the next steps.</p>
            <p>Kind regards,<br><strong>Mobsie Kids</strong></p>
          </div>
        </div>`,
    });
    return result.messageId;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Approval email delivery failed", error);
    throw new AppError(
      502,
      "APPROVAL_EMAIL_FAILED",
      "The application was approved, but the email could not be delivered. Check the SMTP settings and try approving again.",
    );
  }
}
