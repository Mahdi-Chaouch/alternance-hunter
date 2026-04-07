import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import { getOptionalEnv } from "@/lib/env";
import { getServerSession } from "@/lib/auth-session";
import {
  checkRateLimit,
  retryAfterSeconds,
  RATE_LIMIT_SUPPORT_PER_MINUTE,
} from "@/lib/rate-limit";

function getClientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

const MAX_MESSAGE = 4000;
const MIN_MESSAGE = 8;

export async function POST(req: Request) {
  const h = await headers();
  const ip = getClientIp(h);
  const rateLimit = await checkRateLimit(
    `support-ip:${ip}`,
    "support",
    RATE_LIMIT_SUPPORT_PER_MINUTE,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Trop de messages. Réessayez dans une minute." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds(rateLimit.resetAt)) },
      },
    );
  }

  const webhookUrl = getOptionalEnv("DISCORD_SUPPORT_WEBHOOK_URL");
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "Le support n'est pas configuré sur ce serveur." },
      { status: 503 },
    );
  }

  let body: { message?: unknown; subject?: unknown; email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide." }, { status: 400 });
  }

  const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
  if (messageRaw.length < MIN_MESSAGE) {
    return NextResponse.json(
      { ok: false, error: `Le message doit contenir au moins ${MIN_MESSAGE} caractères.` },
      { status: 400 },
    );
  }
  if (messageRaw.length > MAX_MESSAGE) {
    return NextResponse.json(
      { ok: false, error: `Le message ne peut pas dépasser ${MAX_MESSAGE} caractères.` },
      { status: 400 },
    );
  }

  const subjectRaw =
    typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const emailFromBody = typeof body.email === "string" ? body.email.trim().slice(0, 320) : "";

  const session = await getServerSession();
  const sessionEmail = session?.user?.email?.trim() ?? "";
  const userName = session?.user?.name?.trim() ?? "";
  const displayEmail = sessionEmail || emailFromBody;

  if (!sessionEmail && emailFromBody) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFromBody);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Adresse e-mail invalide." }, { status: 400 });
    }
  }

  if (!sessionEmail && !emailFromBody) {
    return NextResponse.json(
      { ok: false, error: "Indiquez une adresse e-mail pour que nous puissions vous répondre." },
      { status: 400 },
    );
  }

  const description =
    messageRaw.length > 4090 ? `${messageRaw.slice(0, 4087)}...` : messageRaw;

  const embed: {
    title: string;
    description: string;
    color: number;
    fields: { name: string; value: string; inline?: boolean }[];
    timestamp: string;
  } = {
    title: subjectRaw || "Message support Alternance Hunter",
    description,
    color: 0x5865f2,
    fields: [
      { name: "Email", value: displayEmail.slice(0, 1024) || "—", inline: true },
      ...(userName ? [{ name: "Nom", value: userName.slice(0, 1024), inline: true }] : []),
      { name: "IP (approx.)", value: ip.slice(0, 64), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [embed],
        username: "Alternance Hunter — Support",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[support] Discord webhook error", res.status, text);
      return NextResponse.json(
        { ok: false, error: "Envoi impossible pour le moment. Réessayez plus tard." },
        { status: 502 },
      );
    }
  } catch (e) {
    console.error("[support] Discord fetch", e);
    return NextResponse.json(
      { ok: false, error: "Envoi impossible pour le moment. Réessayez plus tard." },
      { status: 502 },
    );
  }

  const resendApiKey = getOptionalEnv("RESEND_API_KEY");
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "Alternance Hunter <noreply@alternance-hunter.com>",
        to: [displayEmail],
        subject: `[Support] ${subjectRaw || "Votre message a bien été reçu"}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
            <h2 style="color:#8b5cf6;margin-bottom:8px">Alternance Hunter — Support</h2>
            <p>Bonjour${userName ? ` ${userName}` : ""},</p>
            <p>Nous avons bien reçu votre message et reviendrons vers vous dès que possible.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
            <p style="color:#6b7280;font-size:14px"><strong>Votre message :</strong></p>
            <blockquote style="border-left:3px solid #8b5cf6;margin:0;padding:12px 16px;background:#f9f7ff;color:#374151;font-size:14px;white-space:pre-wrap">${messageRaw.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</blockquote>
            <p style="margin-top:24px;color:#6b7280;font-size:13px">Ceci est un accusé de réception automatique. Ne répondez pas à cet e-mail.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error("[support] Resend error", e);
    }
  }

  return NextResponse.json({ ok: true });
}
