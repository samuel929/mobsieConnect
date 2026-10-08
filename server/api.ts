import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import type { ApiFailure, ApiSuccess, Role, SessionUser } from "@/types/domain";
import { assertCurrentSession, getRequestUser, requireRole } from "./auth";
import { normalizeError } from "./errors";
import { enforceRateLimit } from "./rateLimit";

export type ApiContext = { user: SessionUser | null; requestId: string };
export type ApiOptions = {
  auth?: boolean;
  roles?: Role[];
  methods: string[];
  rateLimit?: boolean;
};

export function apiHandler<T>(
  options: ApiOptions,
  handler: (
    req: NextApiRequest,
    res: NextApiResponse<ApiSuccess<T> | ApiFailure>,
    context: ApiContext,
  ) => Promise<void>,
): NextApiHandler {
  return async (req, res) => {
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Application-Token",
      );
      res.setHeader("Access-Control-Allow-Methods", [...options.methods, "OPTIONS"].join(", "));
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    try {
      if (!req.method || !options.methods.includes(req.method)) {
        res.setHeader("Allow", options.methods);
        res.status(405).json({
          ok: false,
          error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed.", requestId },
        });
        return;
      }
      if (options.rateLimit !== false) await enforceRateLimit(req);
      const user = options.auth === false ? null : await getRequestUser(req);
      if (user && options.roles) requireRole(user, options.roles);
      if (user && !["GET", "HEAD"].includes(req.method)) await assertCurrentSession(user);
      await handler(req, res, { user, requestId });
    } catch (error) {
      const appError = normalizeError(error);
      if (appError.status >= 500) console.error({ requestId, code: appError.code, error });
      res.status(appError.status).json({
        ok: false,
        error: {
          code: appError.code,
          message: appError.message,
          fieldErrors:
            appError.code === "VALIDATION_ERROR"
              ? (appError.details as Record<string, string[]>)
              : undefined,
          requestId,
        },
      });
    }
  };
}

export function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function pageLimit(value: string | string[] | undefined, max = 100) {
  const parsed = Number(one(value) ?? 20);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), max) : 20;
}

export function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(one(value) ?? 1);
  return Number.isFinite(parsed) ? Math.max(Math.floor(parsed), 1) : 1;
}
