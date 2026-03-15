import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import {
  getInvitedEmails,
  addInvitedEmail,
  removeInvitedEmail,
} from "@/lib/invited-emails";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  const emails = await getInvitedEmails();
  return NextResponse.json({ emails });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json(
      { detail: "Body JSON invalide." },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json(
      { detail: "Champ email requis." },
      { status: 400 },
    );
  }

  const ok = await addInvitedEmail(email);
  if (!ok) {
    return NextResponse.json(
      { detail: "Email invalide ou deja present." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, email: email.toLowerCase() }, { status: 201 });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  let email: string;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { email?: string };
      email = typeof body.email === "string" ? body.email.trim() : "";
    } catch {
      return NextResponse.json(
        { detail: "Body JSON invalide." },
        { status: 400 },
      );
    }
  } else {
    const { searchParams } = new URL(request.url);
    email = (searchParams.get("email") ?? "").trim();
  }

  if (!email) {
    return NextResponse.json(
      { detail: "Email requis (body.email ou query email)." },
      { status: 400 },
    );
  }

  const removed = await removeInvitedEmail(email);
  return NextResponse.json({ ok: true, removed });
}
