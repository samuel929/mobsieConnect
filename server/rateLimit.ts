import type { NextApiRequest } from "next";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { AppError } from "./errors";

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();
let redisReadLimiter: Ratelimit | null | undefined;
let redisWriteLimiter: Ratelimit | null | undefined;

function getRedisLimiter(write: boolean) {
  const cached = write ? redisWriteLimiter : redisReadLimiter;
  if (cached !== undefined) return cached;
  // Upstash's direct integration uses the UPSTASH_* names. Older Vercel
  // Storage integrations expose the same REST credentials as KV_REST_API_*.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    if (write) redisWriteLimiter = null;
    else redisReadLimiter = null;
    return null;
  }
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(write ? 30 : 120, "1 m"),
    prefix: write ? "mobsie:api:write" : "mobsie:api:read",
    analytics: true,
  });
  if (write) redisWriteLimiter = limiter;
  else redisReadLimiter = limiter;
  return limiter;
}

function clientIdentifier(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  return `${ip}:${req.url?.split("?")[0] ?? "api"}`;
}

export async function enforceRateLimit(req: NextApiRequest) {
  const write = !["GET", "HEAD", "OPTIONS"].includes(req.method ?? "GET");
  const identifier = `${clientIdentifier(req)}:${write ? "write" : "read"}`;
  const limiter = getRedisLimiter(write);
  if (limiter) {
    const result = await limiter.limit(identifier);
    if (!result.success) {
      throw new AppError(429, "RATE_LIMITED", "Too many requests. Please wait and try again.");
    }
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new AppError(503, "RATE_LIMIT_NOT_CONFIGURED", "Request protection is not configured.");
  }
  const now = Date.now();
  const bucket = memoryBuckets.get(identifier);
  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(identifier, { count: 1, resetAt: now + 60_000 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > (write ? 30 : 120)) {
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Please wait and try again.");
  }
}
