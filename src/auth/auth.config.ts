import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";
import { routing } from "@/i18n/routing";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: `/${routing.defaultLocale}/login`,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // Generic rejection (same as wrong credentials) rather than a
        // distinct error — don't hint to an attacker that they're being
        // rate limited rather than just guessing wrong.
        const { allowed } = await checkRateLimit(`login:${getClientIp(request)}`, 10, 15 * 60 * 1000);
        if (!allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { carrier: true },
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          carrierId: user.carrier?.id ?? null,
          carrierStatus: user.carrier?.status ?? null,
        };
      },
    }),
    // Bare reference (not called) — Auth.js v5 invokes it with no args and
    // fills clientId/clientSecret from the standard AUTH_GOOGLE_ID /
    // AUTH_GOOGLE_SECRET env vars automatically.
    Google,
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider !== "google") return true;

      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Google sign-in is only for carrier accounts; a client account with
        // this email must keep using email/password login.
        return existing.role === "CARRIER";
      }

      await prisma.user.create({
        data: {
          email,
          name: user.name,
          image: user.image,
          role: "CARRIER",
        },
      });
      return true;
    },
    jwt: async ({ token, user, account, trigger }) => {
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          include: { carrier: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.carrierId = dbUser.carrier?.id ?? null;
          token.carrierStatus = dbUser.carrier?.status ?? null;
        }
        return token;
      }

      if (user) {
        token.id = user.id as string;
        token.role = user.role as NonNullable<typeof user.role>;
        token.carrierId = user.carrierId ?? null;
        token.carrierStatus = user.carrierStatus ?? null;
        return token;
      }

      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          include: { carrier: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.carrierId = dbUser.carrier?.id ?? null;
          token.carrierStatus = dbUser.carrier?.status ?? null;
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.carrierId = token.carrierId;
      session.user.carrierStatus = token.carrierStatus;
      return session;
    },
  },
};
