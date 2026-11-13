import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/privacy", "/support", "/api", "/_next", "/favicon.ico"];
async function session(req: NextRequest) {
  const token = req.cookies.get("mobsie_session")?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret || secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: process.env.JWT_ISSUER ?? "mobsie-connect",
      audience: process.env.JWT_AUDIENCE ?? "mobsie-admin",
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (PUBLIC_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }
  const user = await session(req);
  if (!user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  // Page access is driven by the user's database-backed dashboard role after
  // boot. Do not hard-code TEACHER routes here: doing so would override grants
  // changed in Roles & Permissions. Sensitive mutations are still protected by
  // their API role/permission checks.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
