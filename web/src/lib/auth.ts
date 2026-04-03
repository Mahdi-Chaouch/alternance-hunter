import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getRequiredEnv, isProduction } from "./env";
import { pgPool } from "./db";

const DATABASE_URL = getRequiredEnv(
  "DATABASE_URL",
  "postgres://postgres:postgres@127.0.0.1:5432/alternance_mails",
);
const authUrlRaw =
  (process.env.BETTER_AUTH_URL ?? process.env.VERCEL_URL ?? "").trim();
if (isProduction && !authUrlRaw) {
  throw new Error(
    "[Production] Set BETTER_AUTH_URL or VERCEL_URL in your environment.",
  );
}
const rawAuthUrl = authUrlRaw || "http://localhost:3000";
const BETTER_AUTH_URL =
  rawAuthUrl.startsWith("http://") || rawAuthUrl.startsWith("https://")
    ? rawAuthUrl
    : `https://${rawAuthUrl}`;
const BETTER_AUTH_SECRET = getRequiredEnv(
  "BETTER_AUTH_SECRET",
  "dev-secret-not-for-production",
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || undefined;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined;

if (isProduction && (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)) {
  throw new Error(
    "[Production] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required. Set them in your environment.",
  );
}
const GOOGLE_GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export const auth = betterAuth({
  appName: "Alternance Pipeline",
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  database: pgPool,
  plugins: [nextCookies()],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: false,
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
