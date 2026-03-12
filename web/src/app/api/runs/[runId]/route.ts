import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { readJsonSafely } from "@/lib/http";

type Params = {
  params: Promise<{ runId: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  try {
    const { runId } = await params;
    const { baseUrl, token } = getBackendConfig();
    const { searchParams } = new URL(request.url);
    const tail = searchParams.get("tail") ?? "200";

    const response = await fetch(
      `${baseUrl}/runs/${encodeURIComponent(runId)}?tail=${encodeURIComponent(tail)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: getAuthHeaders(token),
      },
    );
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
