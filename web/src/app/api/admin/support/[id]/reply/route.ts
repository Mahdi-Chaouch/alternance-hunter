import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminSession } from "@/lib/admin-guard";
import { markTicketReplied } from "@/lib/support-tickets";
import { getOptionalEnv } from "@/lib/env";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) {
    return NextResponse.json({ detail: "ID invalide." }, { status: 400 });
  }

  let body: { message?: unknown; to?: unknown; extraEmails?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ detail: "Corps JSON invalide." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ detail: "Le message est requis." }, { status: 400 });
  }

  const toRaw = typeof body.to === "string" ? body.to.trim() : "";
  if (!toRaw) {
    return NextResponse.json({ detail: "Destinataire requis." }, { status: 400 });
  }

  const extraEmailsRaw = typeof body.extraEmails === "string" ? body.extraEmails : "";
  const extraEmails = extraEmailsRaw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  const toList = Array.from(new Set([toRaw, ...extraEmails]));

  const resendApiKey = getOptionalEnv("RESEND_API_KEY");
  if (!resendApiKey) {
    return NextResponse.json({ detail: "RESEND_API_KEY non configuré." }, { status: 503 });
  }

  const resend = new Resend(resendApiKey);
  const { error: resendError } = await resend.emails.send({
    from: "Alternance Hunter Support <noreply@alternance-hunter.com>",
    to: toList,
    subject: "Réponse de l'équipe Alternance Hunter",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="color:#8b5cf6;margin-bottom:8px">Alternance Hunter — Support</h2>
        <p>Bonjour,</p>
        <div style="white-space:pre-wrap;line-height:1.7">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#6b7280;font-size:13px">L'équipe Alternance Hunter</p>
      </div>
    `,
  });

  if (resendError) {
    console.error("[admin/support/reply] Resend error", resendError);
    return NextResponse.json({ detail: "Erreur lors de l'envoi." }, { status: 502 });
  }

  await markTicketReplied(ticketId, admin.email);

  return NextResponse.json({ ok: true, sentTo: toList });
}
