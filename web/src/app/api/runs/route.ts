import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { readJsonSafely } from "@/lib/http";
import { getUserProfile } from "@/lib/user-profile";

type RequestInitWithJson = RequestInit & {
  body?: string;
};

type SessionUser = {
  id?: string;
  email?: string | null;
};

type GoogleLinkedAccount = {
  providerId?: string;
  accountId?: string;
  scope?: string | null;
  scopes?: string[];
};

type GoogleAccessTokenPayload = {
  accessToken?: string;
  accessTokenExpiresAt?: Date | string | null;
  scopes?: string[];
};

const REQUIRED_GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.compose"] as const;
const MODES_REQUIRING_GMAIL_CONTEXT = new Set(["pipeline", "drafts"]);

function buildUserScopedHeaders(user: SessionUser): HeadersInit {
  const scopedHeaders: Record<string, string> = {};
  if (user.id?.trim()) {
    scopedHeaders["x-run-user-id"] = user.id.trim();
  }
  if (user.email?.trim()) {
    scopedHeaders["x-run-user-email"] = user.email.trim().toLowerCase();
  }
  return scopedHeaders;
}

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

async function resolveGoogleOAuthRunContext(): Promise<
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
        { detail: "Compte Google non connecte. Connectez Google avant de lancer un run." },
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

  return {
    ok: true,
    payload: {
      oauth_access_token: accessToken,
      oauth_refresh_token: "",
      oauth_client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
      oauth_client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
      oauth_token_uri: process.env.GOOGLE_TOKEN_URI ?? "https://oauth2.googleapis.com/token",
      oauth_scope: tokenScopesString,
      oauth_account_id: googleAccount.accountId ?? "",
      oauth_access_token_expires_at: expiresAt,
    },
  };
}

function shouldRequireGmailContext(payload: Record<string, unknown>): boolean {
  const modeRaw = payload.mode;
  const mode = typeof modeRaw === "string" ? modeRaw.toLowerCase() : "pipeline";
  const dryRun = payload.dry_run === true;
  return MODES_REQUIRING_GMAIL_CONTEXT.has(mode) && !dryRun;
}

async function forward(
  path: string,
  user: SessionUser,
  init: RequestInitWithJson = {},
): Promise<NextResponse> {
  try {
    const { baseUrl, token } = getBackendConfig();
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...getAuthHeaders(token),
        ...buildUserScopedHeaders(user),
        ...(init.headers ?? {}),
      },
    });
    const body = await readJsonSafely(response);
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        detail:
          "Backend Python inaccessible. Verifie PIPELINE_API_BASE_URL et demarre backend_api.py.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ detail: "Payload JSON invalide." }, { status: 400 });
  }

  let bodyPayload: Record<string, unknown> = payload;

  const userId = authResult.value.user.id?.trim();
  if (userId) {
    try {
      const profile = await getUserProfile(userId);
      if (profile) {
        bodyPayload = {
          ...bodyPayload,
          sender_first_name: profile.first_name,
          sender_last_name: profile.last_name,
          sender_linkedin_url: profile.linkedin_url,
          mail_subject_template: profile.subject_template,
          mail_body_template: profile.body_template,
        };
      }
    } catch {
      // Non-blocking: runs can continue without custom profile data.
    }
  }

  if (shouldRequireGmailContext(payload)) {
    const oauthContext = await resolveGoogleOAuthRunContext();
    if (!oauthContext.ok) {
      return oauthContext.response;
    }
    bodyPayload = {
      ...payload,
      ...oauthContext.payload,
    };
  }

  const body = JSON.stringify(bodyPayload);
  return forward("/runs", authResult.value.user, { method: "POST", body });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "20";
  return forward(`/runs?limit=${encodeURIComponent(limit)}`, authResult.value.user, {
    method: "GET",
  });
}
