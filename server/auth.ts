import type { GetServerSidePropsContext, GetServerSidePropsResult, NextApiRequest } from "next";
import { SignJWT, jwtVerify } from "jose";
import { parseCookie, stringifySetCookie } from "cookie";
import type { Role, SessionUser } from "@/types/domain";
import { AppError } from "./errors";
import { query } from "./db";

export const SESSION_COOKIE = "mobsie_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function jwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    tenantId: user.tenantId,
    branchId: user.branchId,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(process.env.JWT_ISSUER ?? "mobsie-connect")
    .setAudience(process.env.JWT_AUDIENCE ?? "mobsie-admin")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(jwtKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser> {
  try {
    const { payload } = await jwtVerify(token, jwtKey(), {
      issuer: process.env.JWT_ISSUER ?? "mobsie-connect",
      audience: process.env.JWT_AUDIENCE ?? "mobsie-admin",
      algorithms: ["HS256"],
    });
    return {
      id: payload.sub as string,
      tenantId: payload.tenantId as string,
      branchId: (payload.branchId as string | null) ?? null,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
    };
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Your session has expired. Please sign in.");
  }
}

export async function getRequestUser(req: Pick<NextApiRequest, "headers" | "cookies">) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = bearer ?? req.cookies?.[SESSION_COOKIE];
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
  return verifySessionToken(token);
}

/**
 * JWTs can outlive a development database reset. Validate mutation sessions so
 * inserts never fail later with an opaque tenant/user foreign-key error.
 */
export async function assertCurrentSession(user: SessionUser) {
  const result = await query<{ id: string }>(
    `SELECT u.id
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1 AND u.tenant_id = $2 AND u.is_active = true
     LIMIT 1`,
    [user.id, user.tenantId],
  );
  if (!result.rows[0]) {
    throw new AppError(
      401,
      "STALE_SESSION",
      "Your login refers to data that no longer exists. Sign out and sign in again.",
    );
  }
}

export function requireRole(user: SessionUser, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
}

export function sessionCookie(token: string) {
  return stringifySetCookie({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export function clearSessionCookie() {
  return stringifySetCookie({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export function withPageAuth(
  allowedRoles: Role[] = ["PRINCIPAL", "TEACHER"],
  resolver?: (
    context: GetServerSidePropsContext,
    user: SessionUser,
  ) => Promise<Record<string, unknown>>,
) {
  return async (
    context: GetServerSidePropsContext,
  ): Promise<GetServerSidePropsResult<Record<string, unknown>>> => {
    try {
      const token = parseCookie(context.req.headers.cookie ?? "")[SESSION_COOKIE];
      if (!token) throw new Error("Missing session");
      const user = await verifySessionToken(token);
      if (!allowedRoles.includes(user.role)) {
        return { redirect: { destination: "/students", permanent: false } };
      }
      return { props: { user, ...(resolver ? await resolver(context, user) : {}) } };
    } catch {
      return {
        redirect: {
          destination: `/login?next=${encodeURIComponent(context.resolvedUrl)}`,
          permanent: false,
        },
      };
    }
  };
}
