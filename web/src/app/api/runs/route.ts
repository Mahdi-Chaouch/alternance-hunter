import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { readJsonSafely } from "@/lib/http";

type RequestInitWithJson = RequestInit & {
  body?: string;
};

async function forward(
  path: string,
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
  const payload = await request.text();
  return forward("/runs", { method: "POST", body: payload });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "20";
  return forward(`/runs?limit=${encodeURIComponent(limit)}`, { method: "GET" });
}
