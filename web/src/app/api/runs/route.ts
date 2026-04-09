import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { isAdminEmail } from "@/lib/admin-guard";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { resolveGoogleOAuthContext } from "@/lib/google-oauth-context";
import { readJsonSafely } from "@/lib/http";
import {
  checkRateLimit,
  RATE_LIMIT_API_PER_MINUTE,
  retryAfterSeconds,
} from "@/lib/rate-limit";
import { checkRunsQuota } from "@/lib/quotas";
import { insertRunEvent } from "@/lib/run-events";
import { getUserProfile } from "@/lib/user-profile";

type RequestInitWithJson = RequestInit & {
  body?: string;
};

type SessionUser = {
  id?: string;
  email?: string | null;
};

const MODES_REQUIRING_GMAIL_CONTEXT = new Set(["pipeline", "drafts"]);
const ACCEPTED_RUN_REQUEST_FIELDS = new Set([
  "mode",
  "zone",
  "job_type",
  "dry_run",
  "python",
  "max_minutes",
  "max_sites",
  "target_found",
  "workers",
  "focus",
  "sector",
  "specialty",
  "enable_sitemap",
  "insecure",
  "rh_only",
  "draft_file",
  "template",
  "out_dir",
  "sender_first_name",
  "sender_last_name",
  "sender_linkedin_url",
  "sender_portfolio_url",
  "mail_subject_template",
  "mail_body_template",
  "cv",
  "lm_suffix",
  "no_lm",
  "lm",
  "credentials",
  "token",
  "sleep",
  "max",
  "console_auth",
  "resume_log",
]);
const FRONTEND_ONLY_FIELDS = new Set(["job_type"]);
const BACKEND_RUN_FIELDS = new Set([
  ...[...ACCEPTED_RUN_REQUEST_FIELDS].filter((f) => !FRONTEND_ONLY_FIELDS.has(f)),
  "oauth_access_token",
  "oauth_refresh_token",
  "oauth_client_id",
  "oauth_client_secret",
  "oauth_token_uri",
  "oauth_scope",
  "oauth_access_token_expires_at",
  "oauth_account_id",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getUnknownFields(
  payload: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): string[] {
  return Object.keys(payload).filter((key) => !allowedFields.has(key));
}

function pickAllowedFields(
  payload: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (allowedFields.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

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
    if (
      path === "/runs" &&
      init.method === "POST" &&
      response.ok &&
      body &&
      typeof (body as { run_id?: string }).run_id === "string"
    ) {
      const runId = (body as { run_id: string }).run_id;
      insertRunEvent({
        runId,
        ownerUserId: user.id ?? "",
        ownerEmail: user.email ?? "",
      }).catch(() => {});
    }
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

  const userId = authResult.value.user.id?.trim() ?? "";
  const isAdmin = isAdminEmail(authResult.value.user.email);

  if (!isAdmin) {
    const rateLimit = await checkRateLimit(userId, "api", RATE_LIMIT_API_PER_MINUTE);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          detail:
            "Trop de requetes. patienter avant de reessayer.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds(rateLimit.resetAt)),
          },
        },
      );
    }

    const runsQuota = await checkRunsQuota(userId);
    if (!runsQuota.allowed) {
      return NextResponse.json(
        {
          detail: `Quota de runs atteint (${runsQuota.limit} par jour). Reessayez demain.`,
          current: runsQuota.current,
          limit: runsQuota.limit,
        },
        { status: 429 },
      );
    }
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!isRecord(parsed)) {
      return NextResponse.json(
        { detail: "Payload JSON invalide. Objet JSON attendu." },
        { status: 400 },
      );
    }
    payload = parsed;
  } catch {
    return NextResponse.json({ detail: "Payload JSON invalide." }, { status: 400 });
  }

  const unknownFields = getUnknownFields(payload, ACCEPTED_RUN_REQUEST_FIELDS);
  if (unknownFields.length > 0) {
    return NextResponse.json(
      {
        detail: `Champs non autorises pour /api/runs: ${unknownFields.sort().join(", ")}`,
      },
      { status: 400 },
    );
  }

  let bodyPayload: Record<string, unknown> = pickAllowedFields(payload, BACKEND_RUN_FIELDS);

  const userIdForProfile = authResult.value.user.id?.trim();
  if (userIdForProfile) {
    try {
      const profile = await getUserProfile(userIdForProfile);
      if (profile) {
        const jobType = typeof payload.job_type === "string" ? payload.job_type : "alternance";
        const isStage = jobType === "stage";
        const jobLabel = isStage ? "stage" : "alternance";
        const jobLabelArticle = isStage ? "de stage" : "d'alternance";
        const subjectTemplate = profile.subject_template ||
          `Candidature ${jobLabel} — {{ENTREPRISE}}`;
        const bodyTemplate = profile.body_template ||
          `Bonjour,\n\nJe me permets de vous contacter dans le cadre de ma recherche ${jobLabelArticle}.\nJe suis très intéressé(e) par une opportunité au sein de {{ENTREPRISE}}.\n\nCordialement,\n{{NOM_COMPLET}}`;
        bodyPayload = {
          ...bodyPayload,
          sender_first_name: profile.first_name,
          sender_last_name: profile.last_name,
          sender_linkedin_url: profile.linkedin_url,
          sender_portfolio_url: profile.portfolio_url,
          mail_subject_template: subjectTemplate,
          mail_body_template: bodyTemplate,
        };
      }
    } catch {
      // Non-blocking: runs can continue without custom profile data.
    }
  }

  if (shouldRequireGmailContext(bodyPayload)) {
    const oauthContext = await resolveGoogleOAuthContext();
    if (!oauthContext.ok) {
      return oauthContext.response;
    }
    bodyPayload = {
      ...bodyPayload,
      ...oauthContext.payload,
    };
  }

  const body = JSON.stringify(pickAllowedFields(bodyPayload, BACKEND_RUN_FIELDS));
  return forward("/runs", authResult.value.user, { method: "POST", body });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const userId = authResult.value.user.id?.trim() ?? "";
  const isAdmin = isAdminEmail(authResult.value.user.email);

  if (!isAdmin) {
    const rateLimit = await checkRateLimit(userId, "api", RATE_LIMIT_API_PER_MINUTE);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          detail:
            "Trop de requetes. Veuillez patienter avant de reessayer.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds(rateLimit.resetAt)),
          },
        },
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "20";
  return forward(`/runs?limit=${encodeURIComponent(limit)}`, authResult.value.user, {
    method: "GET",
  });
}
