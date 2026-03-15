import { NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
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

export async function GET(): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { baseUrl, token } = getBackendConfig();
    const response = await fetch(`${baseUrl}/analytics`, {
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
