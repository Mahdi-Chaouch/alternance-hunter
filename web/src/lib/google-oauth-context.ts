import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isProduction } from "@/lib/env";

export type GoogleLinkedAccount = {
  providerId?: string;
  accountId?: string;
  scope?: string | null;
  scopes?: string[];
};

export type GoogleAccessTokenPayload = {
  accessToken?: string;
  accessTokenExpiresAt?: Date | string | null;
  scopes?: string[];
};

const REQUIRED_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

function normalizeScopeList(account: GoogleLinkedAccount): string[] {
  if (Array.isArray(account.scopes) && account.scopes.length > 0) {
    return account.scopes;
  }
  if (!account.scope) {
    return [];
  }
  return account.scope
    .split(" ")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

function hasRequiredGmailScopes(scopes: string[]): boolean {
  return REQUIRED_GMAIL_SCOPES.every((requiredScope) => scopes.includes(requiredScope));
}

/**
 * Resolves the current user's Google OAuth context (access token, client id/secret, etc.)
 * for use with the backend (e.g. runs requiring Gmail, candidatures sync from Gmail).
 */
export async function resolveGoogleOAuthContext(): Promise<
  | { ok: true; payload: Record<string, string> }
  | { ok: false; response: NextResponse<{ detail: string }> }
> {
  const linkedAccounts = (await auth.api.listUserAccounts({
    headers: await headers(),
  })) as GoogleLinkedAccount[];
  const googleAccount = linkedAccounts.find((account) => account.providerId === "google");
  if (!googleAccount) {
    return {
      ok: false,
      response: NextResponse.json(
        { detail: "Compte Google non connecte. Connectez Google avant d'utiliser cette fonctionnalite." },
        { status: 400 },
      ),
    };
  }

  const scopes = normalizeScopeList(googleAccount);
  if (!hasRequiredGmailScopes(scopes)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          detail:
            "Scopes Gmail manquants. Reconnectez Google avec les permissions de creation de drafts.",
        },
        { status: 400 },
      ),
    };
  }

  let accessTokenPayload: GoogleAccessTokenPayload | null = null;
  try {
    accessTokenPayload = (await auth.api.getAccessToken({
      headers: await headers(),
      body: {
        providerId: "google",
        ...(googleAccount.accountId ? { accountId: googleAccount.accountId } : {}),
      },
    })) as GoogleAccessTokenPayload;
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          detail:
            "Impossible de recuperer un token OAuth Google valide. Reconnectez Google puis reessayez.",
        },
        { status: 400 },
      ),
    };
  }

  const accessToken = accessTokenPayload?.accessToken?.trim();
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          detail:
            "Contexte OAuth Google incomplet. Reconnectez Google pour recuperer un access token valide.",
        },
        { status: 400 },
      ),
    };
  }

  const tokenScopes =
    Array.isArray(accessTokenPayload?.scopes) && accessTokenPayload.scopes.length > 0
      ? accessTokenPayload.scopes
      : scopes;
  const tokenScopesString = tokenScopes.join(" ");
  const expiresRaw = accessTokenPayload?.accessTokenExpiresAt;
  const expiresAt =
    expiresRaw instanceof Date
      ? expiresRaw.toISOString()
      : typeof expiresRaw === "string"
        ? expiresRaw
        : "";

  const oauthClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const oauthClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (isProduction && (!oauthClientId || !oauthClientSecret)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          detail:
            "Configuration OAuth manquante en production. Definissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.",
        },
        { status: 503 },
      ),
    };
  }

  return {
    ok: true,
    payload: {
      oauth_access_token: accessToken,
      oauth_refresh_token: "",
      oauth_client_id: oauthClientId,
      oauth_client_secret: oauthClientSecret,
      oauth_token_uri: process.env.GOOGLE_TOKEN_URI ?? "https://oauth2.googleapis.com/token",
      oauth_scope: tokenScopesString,
      oauth_account_id: googleAccount.accountId ?? "",
      oauth_access_token_expires_at: expiresAt,
    },
  };
}
