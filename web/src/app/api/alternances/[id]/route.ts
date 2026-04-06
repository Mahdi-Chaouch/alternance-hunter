import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { readJsonSafely } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;

  try {
    const { baseUrl, token } = getBackendConfig();
    const url = `${baseUrl.replace(/\/$/, "")}/offres/alternances/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { ...getAuthHeaders(token) },
    });
    const data = await readJsonSafely(response);
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Backend inaccessible: ${message}` }, { status: 503 });
  }
}
