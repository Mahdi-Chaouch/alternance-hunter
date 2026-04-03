import { NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { isAdminEmail } from "@/lib/admin-guard";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { readJsonSafely } from "@/lib/http";
import {
  checkRateLimit,
  RATE_LIMIT_API_PER_MINUTE,
  retryAfterSeconds,
} from "@/lib/rate-limit";
import { checkUploadsQuota, recordUploadEvent } from "@/lib/quotas";

/** Max total request body for upload (CV 10 MB + template 5 MB + form overhead). */
const MAX_UPLOAD_BODY_BYTES = 16 * 1024 * 1024; // 16 MB

function buildUserScopedHeaders(user: { id?: string; email?: string | null }): HeadersInit {
  const scopedHeaders: Record<string, string> = {};
  if (user.id?.trim()) {
    scopedHeaders["x-run-user-id"] = user.id.trim();
  }
  if (user.email?.trim()) {
    scopedHeaders["x-run-user-email"] = user.email.trim().toLowerCase();
  }
  return scopedHeaders;
}

export async function POST(request: Request): Promise<NextResponse> {
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

    const uploadsQuota = await checkUploadsQuota(userId);
    if (!uploadsQuota.allowed) {
      return NextResponse.json(
        {
          detail: `Quota d'uploads atteint (${uploadsQuota.limit} par jour). Reessayez demain.`,
          current: uploadsQuota.current,
          limit: uploadsQuota.limit,
        },
        { status: 429 },
      );
    }
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!Number.isNaN(size) && size > MAX_UPLOAD_BODY_BYTES) {
      return NextResponse.json(
        {
          detail: `Requete trop volumineuse (max ${MAX_UPLOAD_BODY_BYTES / (1024 * 1024)} Mo). CV max 10 Mo, template max 5 Mo.`,
        },
        { status: 413 },
      );
    }
  }

  try {
    const formData = await request.formData();
    const { baseUrl, token } = getBackendConfig();
    const response = await fetch(`${baseUrl}/uploads`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...getAuthHeaders(token),
        ...buildUserScopedHeaders(authResult.value.user),
      },
      body: formData,
    });
    const body = await readJsonSafely(response);
    if (response.ok) {
      recordUploadEvent(userId).catch(() => {});
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

export async function GET(): Promise<NextResponse> {
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

  try {
    const { baseUrl, token } = getBackendConfig();
    const response = await fetch(`${baseUrl}/uploads/status`, {
      method: "GET",
      cache: "no-store",
      headers: {
        ...getAuthHeaders(token),
        ...buildUserScopedHeaders(authResult.value.user),
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
