import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { resolveGoogleOAuthContextForSync } from "@/lib/google-oauth-context";
import { readJsonSafely } from "@/lib/http";

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { baseUrl, token } = getBackendConfig();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const oauthResult = await resolveGoogleOAuthContextForSync();
    const bodyToSend = oauthResult.ok ? { ...body, ...oauthResult.payload } : body ?? {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/candidatures/sync`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(token),
        ...buildUserScopedHeaders(authResult.value.user),
      },
      body: JSON.stringify(bodyToSend),
    });
    clearTimeout(timeoutId);
    const data = await readJsonSafely(response);
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message?.includes("abort"));
    const message =
      err instanceof Error ? err.message : String(err);
    console.error("[candidatures/sync] Backend request failed:", message);
    return NextResponse.json(
      {
        detail: isTimeout
          ? "Le backend a mis trop de temps à répondre (serveur en veille ?). Ouvrez d'abord alternance-killer.onrender.com/docs puis réessayez."
          : `Backend inaccessible: ${message}. Vérifiez que Render est démarré (ouvrez .onrender.com/docs) et PIPELINE_API_BASE_URL.`,
      },
      { status: 503 },
    );
  }
}
