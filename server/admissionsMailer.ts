import nodemailer from "nodemailer";
import path from "path";

import { AppError } from "./errors";

type Applicant = {
  to: string;
  parentName: string;
  childName: string;
};

type WaitingListEmail = Applicant & { position?: number; total?: number };
type InterviewEmail = Applicant & {
  interviewDate?: string | null;
  interviewTime?: string | null;
  teamName?: string | null;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function transport() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host || !user || !pass || !Number.isInteger(port)) {
    throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Admissions email is not configured.");
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
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function send(input: Applicant & { subject: string; heading: string; paragraphs: string[] }) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) throw new AppError(503, "EMAIL_NOT_CONFIGURED", "The email sender address is not configured.");
  const parentName = input.parentName || "Parent/Guardian";
  const contact = "Should you require assistance, please contact us on WhatsApp at 063 956 8733 or email info@mobsiekids.co.za.";
  const text = [
    `Hi ${parentName},`, "", ...input.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    contact, "", "Warm regards,", "Mobsie Kids Playschool Team", "",
    "This is an automated email. Please do not reply.",
  ].join("\n");
  const paragraphs = input.paragraphs.map((paragraph) => `<p style="margin:0 0 18px">${escapeHtml(paragraph)}</p>`).join("");
  return transport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text,
    attachments: [{ filename: "mobsie-logo.png", path: path.join(process.cwd(), "public", "mobsie-logo.png"), cid: "mobsie-logo" }],
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f7f5fb;font-family:Arial,sans-serif;color:#111"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:25px"><img src="cid:mobsie-logo" width="210" alt="Mobsie Kids Playschool"></td></tr><tr><td style="height:8px;background:linear-gradient(90deg,#4faa6b 0 25%,#ff7a16 25% 50%,#ffb51b 50% 75%,#7c55d9 75% 100%)"></td></tr><tr><td align="center" style="padding:30px;background:#edf8f0"><h1 style="margin:0;color:#184f3a;font-size:28px">${escapeHtml(input.heading)}</h1></td></tr><tr><td style="padding:32px 36px;font-size:16px;line-height:1.7"><p style="margin:0 0 18px">Hi ${escapeHtml(parentName)},</p>${paragraphs}<p style="margin:0 0 18px">Should you require assistance, please contact us:</p><p style="margin:0 0 18px">📱 WhatsApp: <a href="https://wa.me/27639568733" style="color:#e76012">063 956 8733</a><br>📧 <a href="mailto:info@mobsiekids.co.za" style="color:#e76012">info@mobsiekids.co.za</a></p><p>Warm regards,<br><strong>Mobsie Kids Playschool Team</strong></p></td></tr><tr><td align="center" style="padding:20px;background:#205c50;color:#fff;font-size:12px">This is an automated email. Please do not reply.</td></tr></table></td></tr></table></body></html>`,
  });
}

export function sendApplicationReceivedEmail(input: Applicant) {
  return send({
    ...input,
    subject: `${input.childName}'s application received`,
    heading: "Application received",
    paragraphs: [
      "Thank you for choosing Mobsie Kids Playschool and for taking the time to submit your application.",
      `We appreciate the opportunity to learn more about ${input.childName} and your family. We will provide further communication about the next steps once our admissions team has reviewed the application.`,
    ],
  });
}

export function sendApplicationWaitingListEmail(input: WaitingListEmail) {
  const position = input.position && input.total
    ? ` ${input.childName} is currently number ${input.position} of ${input.total} on the waiting list.`
    : "";
  return send({
    ...input,
    subject: `${input.childName} is on the waiting list`,
    heading: "Waiting list update",
    paragraphs: [
      "We understand that choosing the right playschool for your child is an important decision, and we appreciate your patience and understanding throughout the admissions process.",
      `Due to the high number of applications, ${input.childName} has been placed on the waiting list.${position} The application remains under consideration, and we will contact you as soon as a suitable place becomes available.`,
    ],
  });
}

export function sendApplicationInterviewEmail(input: InterviewEmail) {
  const team = input.teamName || "Mobsie Kids admissions team";
  const appointment = [input.interviewDate, input.interviewTime].filter(Boolean).join(" at ");
  return send({
    ...input,
    subject: `We look forward to meeting ${input.childName} and your family`,
    heading: "Interview request",
    paragraphs: [
      `As part of our admissions process, we would like to invite ${input.childName} and your family to meet with the ${team}. The meeting helps us learn more about your child and family, answer your questions, and discuss how we can support your child's learning.${appointment ? ` The proposed appointment is ${appointment}.` : ""}`,
      `We look forward to meeting ${input.childName} and your family. Please contact us if you need to arrange a different time.`,
    ],
  });
}

export function sendApplicationApprovedEmail(input: Applicant) {
  return send({
    ...input,
    subject: `Welcome to Mobsie Kids Playschool, ${input.childName}!`,
    heading: "Application accepted",
    paragraphs: [
      `Congratulations! ${input.childName}'s application has been accepted, and we are delighted to welcome your family to Mobsie Kids Playschool.`,
      "Onboarding details and the next steps will follow shortly. We cannot wait to get started.",
    ],
  });
}

export function sendApplicationDeclinedEmail(input: Applicant) {
  return send({
    ...input,
    subject: "Thank you for considering Mobsie Kids Playschool",
    heading: "Application outcome",
    paragraphs: [
      `Thank you for considering us as part of ${input.childName}'s early learning journey and for taking the time to apply to Mobsie Kids Playschool.`,
      `We are sorry to let you know that we are unable to offer ${input.childName} a place at Mobsie Kids Playschool at this time. We understand that this may not be the outcome you were hoping for.`,
    ],
  });
}

export async function sendParentBroadcastEmail(input: { recipients: string[]; subject: string; body: string }) {
  const from=process.env.SMTP_FROM??process.env.SMTP_USER;
  if(!from) throw new AppError(503,"EMAIL_NOT_CONFIGURED","The email sender address is not configured.");
  const paragraphs=input.body.split(/\n{2,}/).map(part=>part.trim()).filter(Boolean);
  return transport().sendMail({
    from,to:from,bcc:input.recipients,subject:input.subject,
    text:`${input.body}\n\nWarm regards,\nMobsie Kids Playschool Team\n\nThis is an automated email. Please do not reply.`,
    attachments:[{filename:"mobsie-logo.png",path:path.join(process.cwd(),"public","mobsie-logo.png"),cid:"mobsie-logo"}],
    html:`<!doctype html><html lang="en"><body style="margin:0;background:#f7f5fb;font-family:Arial,sans-serif;color:#111"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:25px"><img src="cid:mobsie-logo" width="210" alt="Mobsie Kids Playschool"></td></tr><tr><td style="height:8px;background:linear-gradient(90deg,#4faa6b 0 25%,#ff7a16 25% 50%,#ffb51b 50% 75%,#7c55d9 75% 100%)"></td></tr><tr><td style="padding:32px 36px;font-size:16px;line-height:1.7"><h1 style="margin:0 0 24px;color:#184f3a;font-size:28px">${escapeHtml(input.subject)}</h1>${paragraphs.map(paragraph=>`<p style="margin:0 0 18px">${escapeHtml(paragraph).replaceAll("\n","<br>")}</p>`).join("")}<p>Warm regards,<br><strong>Mobsie Kids Playschool Team</strong></p></td></tr><tr><td align="center" style="padding:20px;background:#205c50;color:#fff;font-size:12px">This is an automated email. Please do not reply.</td></tr></table></td></tr></table></body></html>`,
  });
}
