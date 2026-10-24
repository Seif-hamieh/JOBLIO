import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { assessPassword } from "@/lib/password";
import { db } from "@/server/db";
import { emails, localeFromRequest, sendEmail } from "@/server/mail";
import { provisionNewUser } from "@/server/services/users";
import { USER_INTENTS, type UserIntent } from "@/lib/constants";

const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
    : {}),
};

export const enabledSocialProviders = Object.keys(socialProviders) as ("google" | "github")[];

export const auth = betterAuth({
  appName: "JOBLIO",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  // Passwords are hashed with scrypt (Better Auth default) — never stored in plain text.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }, request) => {
      await sendEmail({ to: user.email, ...emails.resetPassword(user.name, url, localeFromRequest(request)) });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }, request) => {
      await sendEmail({ to: user.email, ...emails.verify(user.name, url, localeFromRequest(request)) });
    },
  },
  socialProviders,
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
  },

  user: {
    additionalFields: {
      intent: { type: "string", required: false, defaultValue: "SEEKER", input: true },
      username: { type: "string", required: false, input: false },
      onboardedAt: { type: "date", required: false, input: false },
      platformRole: { type: "string", required: false, defaultValue: "USER", input: false },
    },
    deleteUser: { enabled: true },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Signed cookie cache avoids a DB round-trip on most requests.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    // Better Auth applies stricter built-in rules to sign-in, sign-up,
    // password reset and verification endpoints on top of this default.
    window: 60,
    max: 120,
    storage: process.env.RATE_LIMIT_STORAGE === "database" ? "database" : "memory",
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // `intent` is the only client-settable extra field — coerce it to a known value.
          const intent = USER_INTENTS.includes(user.intent as UserIntent) ? (user.intent as UserIntent) : "SEEKER";
          return { data: { ...user, intent } };
        },
        after: async (user) => {
          await provisionNewUser(user.id, user.name);
        },
      },
    },
    session: {
      create: {
        // Every way in (password, Google / GitHub, the link in a verification email, the app) creates a session —
        // banned members are refused here. Banning also deletes their existing sessions.
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { bannedAt: true } });
          if (user?.bannedAt) throw new APIError("FORBIDDEN", { message: "This account has been suspended.", code: "ACCOUNT_BANNED" });
          return { data: session };
        },
      },
    },
  },

  hooks: {
    // Refuse common / repeated / sequential / personal passwords wherever a password is set.
    before: createAuthMiddleware(async (ctx) => {
      if (!["/sign-up/email", "/reset-password", "/change-password"].includes(ctx.path)) return;
      const body = (ctx.body ?? {}) as { password?: string; newPassword?: string; email?: string; name?: string };
      const pw = body.newPassword ?? body.password;
      if (typeof pw !== "string") return;
      const problem = assessPassword(pw, [body.email, body.name]).problem;
      if (problem && problem !== "tooShort") throw new APIError("BAD_REQUEST", { message: "Password is too easy to guess", code: `WEAK_PASSWORD_${problem.toUpperCase()}` });
    }),
  },

  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
