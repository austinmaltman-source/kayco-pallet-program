import { betterAuth, BetterAuthError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { sendApprovalRequest, sendPasswordReset } from "@/lib/email";

const authSecret =
  process.env.BETTER_AUTH_SECRET ?? "local-development-secret-change-me";

export const auth = betterAuth({
  secret: authSecret,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      if (!user.email) return;
      await sendPasswordReset({
        user: {
          name: typeof user.name === "string" ? user.name : null,
          email: user.email,
        },
        url,
      });
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "viewer",
        input: false,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: "pending",
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [user] = await db
            .select({ status: users.status })
            .from(users)
            .where(eq(users.id, session.userId))
            .limit(1);

          if (!user || user.status !== "active") {
            throw new BetterAuthError("Account pending admin approval");
          }
        },
      },
    },
    user: {
      create: {
        after: async (user) => {
          if (!user?.email) return;

          try {
            const name =
              typeof user.name === "string" && user.name.trim().length > 0
                ? user.name
                : user.email;

            await sendApprovalRequest({
              name,
              email: user.email,
            });
          } catch (error) {
            console.error("Failed to send approval request email", error);
          }
        },
      },
    },
  },
});
