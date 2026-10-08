import { createHash, randomBytes } from "crypto";
import type { NextApiRequest } from "next";
import { query } from "./db";
import { AppError } from "./errors";

export function createApplicationAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashApplicationAccessToken(token) };
}

export function hashApplicationAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requireApplicationAccess(req: NextApiRequest, applicationId: string) {
  const token = req.headers["x-application-token"];
  if (typeof token !== "string") {
    throw new AppError(401, "APPLICATION_TOKEN_REQUIRED", "Application access token is required.");
  }
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM applications WHERE id = $1 AND access_token_hash = $2
     ) AS exists`,
    [applicationId, hashApplicationAccessToken(token)],
  );
  if (!result.rows[0]?.exists) {
    throw new AppError(403, "APPLICATION_ACCESS_DENIED", "Application access was denied.");
  }
}
