import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getWhitelistEnabled, setWhitelistEnabled } from "@/lib/app-settings";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  const whitelistEnabled = await getWhitelistEnabled();
  return NextResponse.json({ whitelistEnabled });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  let body: { whitelistEnabled?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ detail: "Corps JSON invalide." }, { status: 400 });
  }

  if (typeof body.whitelistEnabled !== "boolean") {
    return NextResponse.json({ detail: "whitelistEnabled (boolean) requis." }, { status: 400 });
  }

  await setWhitelistEnabled(body.whitelistEnabled);
  return NextResponse.json({ ok: true, whitelistEnabled: body.whitelistEnabled });
}
