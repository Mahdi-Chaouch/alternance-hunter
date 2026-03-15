import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getLastRunEvents } from "@/lib/run-events";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

  const runs = await getLastRunEvents(limit);
  return NextResponse.json({ runs });
}
