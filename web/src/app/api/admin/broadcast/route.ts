import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminSession } from "@/lib/admin-guard";
import { getOptionalEnv } from "@/lib/env";

type Payload = {
  from?: unknown;
  recipients?: unknown;
  subject?: unknown;
  message?: unknown;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/g)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (!admin.ok) return admin.response;

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ detail: "Corps JSON invalide." }, { status: 400 });
  }

  const fromInput = typeof body.from === "string" ? body.from.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const recipientsRaw = typeof body.recipients === "string" ? body.recipients : "";
  const recipients = parseRecipients(recipientsRaw);

  if (!fromInput) {
    return NextResponse.json({ detail: "Adresse expéditeur requise." }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(fromInput)) {
    return NextResponse.json({ detail: "Adresse expéditeur invalide." }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ detail: "Sujet requis." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ detail: "Message requis." }, { status: 400 });
  }
  if (recipients.length === 0) {
    return NextResponse.json({ detail: "Ajoutez au moins un destinataire." }, { status: 400 });
  }
  if (recipients.length > 200) {
    return NextResponse.json({ detail: "Maximum 200 destinataires par envoi." }, { status: 400 });
  }

  const invalidRecipients = recipients.filter((email) => !EMAIL_REGEX.test(email));
  if (invalidRecipients.length > 0) {
    return NextResponse.json(
      { detail: `Emails invalides: ${invalidRecipients.slice(0, 5).join(", ")}` },
      { status: 400 },
    );
  }

  const resendApiKey = getOptionalEnv("RESEND_API_KEY");
  if (!resendApiKey) {
    return NextResponse.json({ detail: "RESEND_API_KEY non configuré." }, { status: 503 });
  }

  const resend = new Resend(resendApiKey);
  const fromHeader = `Alternance Hunter News <${fromInput}>`;
  const htmlMessage = escapeHtml(message).replace(/\n/g, "<br/>");

  let successCount = 0;
  const failed: string[] = [];

  for (const to of recipients) {
    const { error } = await resend.emails.send({
      from: fromHeader,
      to: [to],
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;line-height:1.65">
          <p>Bonjour,</p>
          <div>${htmlMessage}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="color:#6b7280;font-size:13px">Message envoyé par l'équipe Alternance Hunter.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[admin/broadcast] Resend error for recipient", to, error);
      failed.push(to);
      continue;
    }
    successCount += 1;
  }

  return NextResponse.json({
    ok: failed.length === 0,
    sent: successCount,
    total: recipients.length,
    failed,
  });
}

