import type { NextApiRequest } from "next";
import { jwtVerify, SignJWT } from "jose";
import { AppError } from "./errors";

export type ParentSession = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  phone: string;
};

const TTL_SECONDS = 60 * 60 * 24 * 30;

function jwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured.");
  }
  return new TextEncoder().encode(secret);
}

export function createParentToken(parent: ParentSession) {
  return new SignJWT({
    tenantId: parent.tenantId,
    email: parent.email,
    name: parent.name,
    phone: parent.phone,
    tokenType: "parent",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(parent.id)
    .setIssuer(process.env.JWT_ISSUER ?? "mobsie-connect")
    .setAudience("mobsie-mobile")
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(jwtKey());
}

export async function verifyParentToken(token: string): Promise<ParentSession> {
  try {
    const { payload } = await jwtVerify(token, jwtKey(), {
      issuer: process.env.JWT_ISSUER ?? "mobsie-connect",
      audience: "mobsie-mobile",
      algorithms: ["HS256"],
    });
    if (payload.tokenType !== "parent") throw new Error("Wrong token type");
    return {
      id: payload.sub as string,
      tenantId: payload.tenantId as string,
      email: payload.email as string,
      name: payload.name as string,
      phone: payload.phone as string,
    };
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Your parent session has expired.");
  }
}

export async function getParent(req: Pick<NextApiRequest, "headers">) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
  }
  return verifyParentToken(authorization.slice(7));
}

export async function getOptionalParent(req: Pick<NextApiRequest, "headers">) {
  if (!req.headers.authorization?.startsWith("Bearer ")) return null;
  return getParent(req);
}
