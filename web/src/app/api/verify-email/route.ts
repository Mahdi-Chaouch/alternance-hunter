import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json({ detail: "Body JSON invalide." }, { status: 400 });
  }

  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  if (!rawCode) {
    return NextResponse.json({ detail: "Code requis." }, { status: 400 });
  }

  try {
    await auth.api.verifyEmail({
      query: {
        token: rawCode,
      },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { detail: "Code invalide ou déjà utilisé." },
      { status: 400 },
    );
  }
}

