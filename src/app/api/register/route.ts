import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth.schema";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const { allowed, retryAfterSeconds } = await checkRateLimit(
    `register:${getClientIp(request)}`,
    10,
    60 * 60 * 1000,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  if (data.role === "CLIENT") {
    await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        phone: data.phone,
        role: "CLIENT",
      },
    });
  } else {
    // Company details are collected afterward on the onboarding-completion
    // step (same one Google sign-in uses) — see /api/carrier/profile.
    await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        role: "CARRIER",
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
