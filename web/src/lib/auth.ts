import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Resend } from "resend";
import { Pool } from "pg";
import { getRequiredEnv, isProduction } from "./env";
import { isInvitedEmail } from "./invited-emails";

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

const AUTH_WHITELIST_ENABLED =
  (process.env.AUTH_WHITELIST_ENABLED ?? "true").trim().toLowerCase() !==
  "false";
const AUTH_WHITELIST =
  process.env.AUTH_ALLOWED_EMAILS?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) ?? [];
const AUTH_WHITELIST_DOMAIN =
  process.env.AUTH_WHITELIST_DOMAIN?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) ?? [];

function isEmailWhitelisted(email: string | null | undefined): boolean {
  if (!AUTH_WHITELIST_ENABLED) return true;
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return false;
  if (AUTH_WHITELIST.length > 0 && AUTH_WHITELIST.includes(value)) {
    return true;
  }
  if (AUTH_WHITELIST_DOMAIN.length > 0) {
    const atIndex = value.lastIndexOf("@");
    if (atIndex > 0) {
      const domain = value.slice(atIndex + 1);
      if (AUTH_WHITELIST_DOMAIN.includes(domain)) return true;
    }
  }
  return AUTH_WHITELIST.length === 0 && AUTH_WHITELIST_DOMAIN.length === 0;
}

async function isEmailAllowed(email: string | null | undefined): Promise<boolean> {
  if (!AUTH_WHITELIST_ENABLED) return true;
  if (isEmailWhitelisted(email)) return true;
  return isInvitedEmail(email);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim();

const resendClient =
  RESEND_API_KEY && RESEND_FROM_EMAIL ? new Resend(RESEND_API_KEY) : null;

const globalForAuth = globalThis as unknown as { authPool?: Pool };

const authPool =
  globalForAuth.authPool ??
  new Pool({
    connectionString: DATABASE_URL,
  });

if (!isProduction) {
  globalForAuth.authPool = authPool;
}

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
  database: authPool,
  plugins: [nextCookies()],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      if (!resendClient || !RESEND_FROM_EMAIL) {
        console.warn(
          "[BetterAuth] Email verification requested but Resend is not configured.",
          JSON.stringify({
            email: user.email,
            url,
            tokenLength: token.length,
          }),
        );
        return;
      }

      await resendClient.emails.send({
        from: RESEND_FROM_EMAIL,
        to: user.email,
        subject: "Activation de votre compte Alternance Hunter",
        html: `
          <p>Bonjour,</p>
          <p>Merci de votre inscription à Alternance Hunter.</p>
          <p>Cliquez sur le lien ci-dessous pour <strong>activer votre compte</strong>&nbsp;:</p>
          <p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>
          <p>Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.</p>
          <p>À bientôt,<br/>L'équipe Alternance Hunter</p>
        `,
      });
    },
    sendOnSignUp: true,
  },
  user: {
    beforeCreate: async ({ data }) => {
      const email = data.email ?? undefined;
      const allowed = await isEmailAllowed(email);
      if (!allowed) {
        throw new Error(
          "Cette adresse email n'est pas autorisée pour le moment. Contactez l'équipe Alternance Hunter.",
        );
      }
      return data;
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      if (!resendClient || !RESEND_FROM_EMAIL) {
        console.warn(
          "[BetterAuth] Password reset requested but Resend is not configured.",
          JSON.stringify({
            email: user.email,
            url,
            tokenLength: token.length,
          }),
        );
        return;
      }

      await resendClient.emails.send({
        from: RESEND_FROM_EMAIL,
        to: user.email,
        subject: "Réinitialisation de votre mot de passe Alternance Hunter",
        html: `
          <p>Bonjour,</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Alternance Hunter.</p>
          <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe&nbsp;:</p>
          <p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>
          <p>Ce lien est valable pendant 60 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
          <p>À bientôt,<br/>L'équipe Alternance Hunter</p>
        `,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60,
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
            allowSignup: async ({ profile }) => {
              const email =
                (profile.email_verified && profile.email) || profile.email;
              const allowed = await isEmailAllowed(email);
              if (!allowed) {
                throw new Error(
                  "Ce compte Google n'est pas autorisé pour le moment. Contactez l'équipe Alternance Hunter.",
                );
              }
              return true;
            },
          },
        }
      : undefined,
});
