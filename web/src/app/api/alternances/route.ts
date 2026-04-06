import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { readJsonSafely } from "@/lib/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { baseUrl, token } = getBackendConfig();
    const { searchParams } = request.nextUrl;
    const params = new URLSearchParams();
    if (searchParams.get("q")) params.set("q", searchParams.get("q")!);
    if (searchParams.get("commune")) params.set("commune", searchParams.get("commune")!);
    if (searchParams.get("range")) params.set("range", searchParams.get("range")!);

    const url = `${baseUrl.replace(/\/$/, "")}/offres/alternances?${params.toString()}`;
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
