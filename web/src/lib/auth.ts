import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/alternance_mails";
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  "6e336476a781adb941ad19e299ed7d34761f794d13a6078ff367c040923184af";

const globalForAuth = globalThis as unknown as { authPool?: Pool };

const authPool =
  globalForAuth.authPool ??
  new Pool({
    connectionString: DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuth.authPool = authPool;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.compose",
];

export const auth = betterAuth({
  appName: "Alternance Pipeline",
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  database: authPool,
  plugins: [nextCookies()],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  account: {
    encryptOAuthTokens: true,
  },
  socialProviders:
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            accessType: "offline",
            prompt: "consent",
            scope: GOOGLE_GMAIL_SCOPES,
          },
        }
      : undefined,
});
