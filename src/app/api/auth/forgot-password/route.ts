import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendMail } from "@/lib/mail";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/passwordReset";
import { forgotPasswordSchema } from "@/lib/validation/auth.schema";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Always responds { ok: true } regardless of whether the email has an
// account — never reveal account existence through this endpoint.
export async function POST(request: Request) {
  const { allowed, retryAfterSeconds } = await checkRateLimit(
    `forgot-password:${getClientIp(request)}`,
    5,
    15 * 60 * 1000,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !isEmailConfigured()) {
    // No account, or email sending isn't configured in this environment —
    // either way the client sees the same generic response.
    if (user && !isEmailConfigured()) {
      console.error("Password reset requested but RESEND_API_KEY is not configured");
    }
    return NextResponse.json({ ok: true });
  }

  // Invalidate any previous outstanding token so an old leaked link can't
  // still be used once a new one is issued.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const { raw, tokenHash } = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const locale = parsed.data.locale === "en" ? "en" : "sr";
  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const resetUrl = `${baseUrl}/${locale}/reset-password?token=${raw}`;

  await sendMail({
    to: user.email,
    subject: "Reset your Travia password",
    html: `<p>Hello,</p><p>We received a request to reset your Travia password. This link expires in 1 hour:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email — your password hasn't been changed.</p>`,
  });

  return NextResponse.json({ ok: true });
}
