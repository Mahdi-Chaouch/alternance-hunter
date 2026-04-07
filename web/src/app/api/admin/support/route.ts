import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getSupportTickets } from "@/lib/support-tickets";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  const tickets = await getSupportTickets();
  return NextResponse.json({ tickets });
}
