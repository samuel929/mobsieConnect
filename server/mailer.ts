import nodemailer from "nodemailer";
import path from "path";

import { AppError } from "./errors";

type ApprovalEmail = {
  to: string;
  parentName: string;
  childName: string;
  reference: string;
  branchName?: string | null;
};

type ApplicationReceivedEmail = { to: string; parentName: string };
type PasswordResetEmail = { to: string; parentName: string; code: string };
type WaitingListEmail = { to: string };

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
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
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

  try {
    const result = await getTransporter().sendMail({
      from,
      to: input.to,
      subject: "Your Mobsie Kids application has been approved",
      attachments: [
        {
          filename: "mobsie-logo.png",
          path: path.join(process.cwd(), "public", "mobsie-logo.png"),
          cid: "mobsie-logo",
        },
      ],
      text: [
        "Dear Parent/Guardian,",
        "",
        "Great news! Your child’s application to Mobsie Kids has been approved.",
        "",
        "You can now log in to the Mobsie Connect app to access your account and stay updated with Mobsie Kids.",
        "",
        "For assistance, please contact info@mobsiekids.co.za.",
        "",
        "Warm regards,",
        "Mobsie Kids Team",
        "",
        "This is an automated email. Please do not reply.",
      ].join("\n"),
      html: `<!doctype html><html lang="en"><body style="margin:0;background:#f7f5fb;font-family:Arial,sans-serif;color:#243142"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:25px"><img src="cid:mobsie-logo" width="210" alt="Mobsie Connect"></td></tr><tr><td style="height:8px;background:linear-gradient(90deg,#4faa6b 0 25%,#ff7a16 25% 50%,#ffb51b 50% 75%,#7c55d9 75% 100%)"></td></tr><tr><td align="center" style="padding:32px 30px;background:#edf8f0"><div style="font-size:38px">🎉</div><h1 style="margin:12px 0 0;color:#184f3a;font-size:28px">Application approved</h1></td></tr><tr><td style="padding:32px 36px;font-size:16px;line-height:1.7"><p>Dear Parent/Guardian,</p><p><strong>Great news!</strong> Your child’s application to Mobsie Kids has been approved.</p><p>You can now log in to the Mobsie Connect app to access your account and stay updated with Mobsie Kids.</p><p>For assistance, please contact <a href="mailto:info@mobsiekids.co.za" style="color:#e76012">info@mobsiekids.co.za</a>.</p><p>Warm regards,<br><strong>Mobsie Kids Team</strong></p></td></tr><tr><td align="center" style="padding:20px;background:#205c50;color:#cde9df;font-size:12px">This is an automated email. Please do not reply.</td></tr></table></td></tr></table></body></html>`,
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

export async function sendApplicationReceivedEmail(input: ApplicationReceivedEmail) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) throw new AppError(503, "EMAIL_NOT_CONFIGURED", "The email sender address is not configured.");
  const parentName = escapeHtml(input.parentName || "Parent/Guardian");
  const text = [
    `Dear ${input.parentName || "Parent/Guardian"},`, "",
    "Thank you for applying to Mobsie Kids.", "",
    "Your child’s application has been successfully received and is currently under review. We’ll be in touch with the outcome and any next steps.", "",
    "For assistance, please contact info@mobsiekids.co.za.", "",
    "Warm regards,", "Mobsie Kids Team", "",
    "This is an automated email. Please do not reply.",
  ].join("\n");
  try {
    const result = await getTransporter().sendMail({
      from, to: input.to, subject: "We received your Mobsie Kids application", text,
      attachments: [{ filename: "mobsie-logo.png", path: path.join(process.cwd(), "public", "mobsie-logo.png"), cid: "mobsie-logo" }],
      html: `<!doctype html><html><body style="margin:0;background:#f7f5fb;font-family:Arial,sans-serif;color:#243142"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:25px"><img src="cid:mobsie-logo" width="210" alt="Mobsie Kids"></td></tr><tr><td style="height:8px;background:#ff7a16"></td></tr><tr><td align="center" style="padding:32px 30px;background:#edf8f0"><div style="font-size:38px">📝</div><h1 style="margin:12px 0 0;color:#184f3a;font-size:28px">Application received</h1></td></tr><tr><td style="padding:32px 36px;font-size:16px;line-height:1.7"><p>Dear ${parentName},</p><p>Thank you for applying to Mobsie Kids.</p><p>Your child’s application has been successfully received and is currently under review. We’ll be in touch with the outcome and any next steps.</p><p>For assistance, please contact <a href="mailto:info@mobsiekids.co.za" style="color:#e76012">info@mobsiekids.co.za</a>.</p><p>Warm regards,<br><strong>Mobsie Kids Team</strong></p></td></tr><tr><td align="center" style="padding:20px;background:#205c50;color:#cde9df;font-size:12px">This is an automated email. Please do not reply.</td></tr></table></td></tr></table></body></html>`,
    });
    return result.messageId;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Application received email delivery failed", error);
    throw new AppError(502, "APPLICATION_EMAIL_FAILED", "The application was saved, but its confirmation email could not be delivered.");
  }
}

export async function sendApplicationWaitingListEmail(input: WaitingListEmail) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) throw new AppError(503, "EMAIL_NOT_CONFIGURED", "The email sender address is not configured.");
  const displayName = "Parent/Guardian";
  const parentName = escapeHtml(displayName);
  const text = [
    `Dear ${displayName},`, "",
    "Thank you for your application to Mobsie Kids.", "",
    "Your child’s application has been placed on our waiting list. We’ll contact you as soon as a space becomes available or if there are any updates regarding your application.", "",
    "No further action is required from you at this time.", "",
    "For assistance, please contact info@mobsiekids.co.za.", "",
    "Warm regards,", "Mobsie Kids Team", "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  try {
    const result = await getTransporter().sendMail({
      from,
      to: input.to,
      subject: "Your Mobsie Kids application is on the waiting list",
      text,
      attachments: [{ filename: "mobsie-logo.png", path: path.join(process.cwd(), "public", "mobsie-logo.png"), cid: "mobsie-logo" }],
      html: `<!doctype html><html lang="en"><body style="margin:0;background:#f7f5fb;font-family:Arial,sans-serif;color:#243142"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:25px"><img src="cid:mobsie-logo" width="210" alt="Mobsie Connect"></td></tr><tr><td style="height:8px;background:linear-gradient(90deg,#4faa6b 0 25%,#ff7a16 25% 50%,#ffb51b 50% 75%,#7c55d9 75% 100%)"></td></tr><tr><td align="center" style="padding:32px 30px;background:#fff7e8"><div style="font-size:38px">⏳</div><h1 style="margin:12px 0 0;color:#184f3a;font-size:28px">Waiting list update</h1></td></tr><tr><td style="padding:32px 36px;font-size:16px;line-height:1.7"><p>Dear ${parentName},</p><p>Thank you for your application to Mobsie Kids.</p><p>Your child’s application has been placed on our waiting list. We’ll contact you as soon as a space becomes available or if there are any updates regarding your application.</p><p style="padding:16px 18px;background:#edf8f0;border-radius:14px;color:#184f3a"><strong>No further action is required from you at this time.</strong></p><p>For assistance, please contact <a href="mailto:info@mobsiekids.co.za" style="color:#e76012">info@mobsiekids.co.za</a>.</p><p>Warm regards,<br><strong>Mobsie Kids Team</strong></p></td></tr><tr><td align="center" style="padding:20px;background:#205c50;color:#cde9df;font-size:12px">This is an automated email. Please do not reply.</td></tr></table></td></tr></table></body></html>`,
    });
    return result.messageId;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Waiting-list email delivery failed", error);
    throw new AppError(502, "WAITING_LIST_EMAIL_FAILED", "The application was placed on the waiting list, but the email could not be delivered.");
  }
}

export async function sendPasswordResetEmail(input: PasswordResetEmail) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) throw new AppError(503, "EMAIL_NOT_CONFIGURED", "The email sender address is not configured.");
  const parentName = escapeHtml(input.parentName || "Parent/Guardian");
  const code = escapeHtml(input.code);
  return getTransporter().sendMail({
    from,
    to: input.to,
    subject: "Reset your Mobsie Connect password",
    text: `Dear ${input.parentName || "Parent/Guardian"},\n\nUse this code to reset your Mobsie Connect password: ${input.code}\n\nThe code expires in 15 minutes. If you did not request this, you can ignore this email.\n\nWarm regards,\nMobsie Kids Team\n\nThis is an automated email. Please do not reply.`,
    attachments: [{ filename: "mobsie-logo.png", path: path.join(process.cwd(), "public", "mobsie-logo.png"), cid: "mobsie-logo" }],
    html: `<!doctype html><html><body style="margin:0;background:#f7f5fb;font-family:Arial,sans-serif;color:#243142"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:24px"><img src="cid:mobsie-logo" width="200" alt="Mobsie Kids"></td></tr><tr><td style="height:8px;background:#ff7a16"></td></tr><tr><td style="padding:34px 36px"><h1 style="margin:0 0 20px;color:#184f3a">Reset your password</h1><p style="font-size:16px;line-height:1.7">Dear ${parentName},</p><p style="font-size:16px;line-height:1.7">Enter this one-time code in the Mobsie Connect app:</p><div style="margin:26px 0;padding:18px;text-align:center;background:#edf8f0;border-radius:16px;color:#184f3a;font-size:34px;font-weight:800;letter-spacing:8px">${code}</div><p style="font-size:14px;color:#66716d">This code expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.</p><p style="font-size:16px;line-height:1.7">Warm regards,<br><strong>Mobsie Kids Team</strong></p></td></tr><tr><td align="center" style="padding:18px;background:#205c50;color:#cde9df;font-size:12px">This is an automated email. Please do not reply.</td></tr></table></td></tr></table></body></html>`,
  });
}
