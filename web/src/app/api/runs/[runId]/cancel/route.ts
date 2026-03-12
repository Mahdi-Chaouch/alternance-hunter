import { NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { readJsonSafely } from "@/lib/http";

type Params = {
  params: Promise<{ runId: string }>;
};

export async function POST(
  _request: Request,
  { params }: Params,
): Promise<NextResponse> {
  try {
    const { runId } = await params;
    const { baseUrl, token } = getBackendConfig();

    const response = await fetch(`${baseUrl}/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      cache: "no-store",
      headers: getAuthHeaders(token),
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
