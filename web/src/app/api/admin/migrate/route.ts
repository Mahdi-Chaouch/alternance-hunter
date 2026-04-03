import { NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { requireAdminSession } from "@/lib/admin-guard";
import { readJsonSafely } from "@/lib/http";

export async function POST(): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return admin.response;
  }

  try {
    const { baseUrl, token } = getBackendConfig();
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/admin/migrate-shared-companies`,
      {
        method: "POST",
        cache: "no-store",
        headers: { ...getAuthHeaders(token) },
      },
    );
    const data = await readJsonSafely(response);
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Backend inaccessible: ${message}` }, { status: 503 });
  }
}
