import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getRunEventsStats } from "@/lib/run-events";
import { getInvitedEmailsCount } from "@/lib/invited-emails";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  const stats = await getRunEventsStats();
  const invited_count = await getInvitedEmailsCount();

  return NextResponse.json({
    total_runs: stats.total_runs,
    runs_by_day: stats.runs_by_day,
    unique_users: stats.unique_users,
    invited_count,
  });
}
