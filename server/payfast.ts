import { createHash } from "crypto";
import { AppError } from "./errors";

export type PayFastFields = Record<string, string>;

function encode(value: string) {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function payFastConfig() {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const appUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!merchantId || !merchantKey || !passphrase || !appUrl) {
    throw new AppError(503, "PAYFAST_NOT_CONFIGURED", "PayFast is not configured on the server.");
  }
  const sandbox = process.env.PAYFAST_SANDBOX !== "false";
  return {
    merchantId, merchantKey, passphrase, appUrl, sandbox,
    processUrl: sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process",
    validateUrl: sandbox ? "https://sandbox.payfast.co.za/eng/query/validate" : "https://www.payfast.co.za/eng/query/validate",
  };
}

export function payFastSignature(fields: PayFastFields, passphrase: string) {
  const pairs = Object.entries(fields)
    .filter(([key, value]) => key !== "signature" && value !== "")
    .map(([key, value]) => `${key}=${encode(String(value))}`);
  pairs.push(`passphrase=${encode(passphrase)}`);
  return createHash("md5").update(pairs.join("&")).digest("hex");
}

export function payFastForm(fields: PayFastFields, processUrl: string) {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const inputs = Object.entries(fields).map(([key, value]) => `<input type="hidden" name="${escape(key)}" value="${escape(value)}">`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Opening PayFast</title></head><body style="font-family:Arial;text-align:center;padding:48px;color:#173f36"><form id="payfast" method="post" action="${escape(processUrl)}">${inputs}<button type="submit" style="border:0;border-radius:14px;padding:15px 28px;background:#ff6b12;color:#fff;font-size:17px;font-weight:700">Continue to PayFast</button></form><p>Redirecting to secure payment…</p><script>document.getElementById('payfast').submit()</script></body></html>`;
}
