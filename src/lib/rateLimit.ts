import { prisma } from "@/lib/prisma";

// Fixed-window counter backed by Postgres (see RateLimitBucket in
// schema.prisma) — serverless functions don't share memory across
// instances, so an in-process counter wouldn't actually limit anything.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);

  // Opportunistic cleanup of expired buckets — avoids needing a cron job
  // for a table that otherwise only ever grows. Run on a small fraction of
  // requests rather than every one, since it's not time-sensitive.
  if (Math.random() < 0.01) {
    prisma.rateLimitBucket
      .deleteMany({ where: { windowStart: { lt: new Date(now - windowMs) } } })
      .catch(() => {});
  }

  return { allowed: bucket.count <= limit, retryAfterSeconds };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
