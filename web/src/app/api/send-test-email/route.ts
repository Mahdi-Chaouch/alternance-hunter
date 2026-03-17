import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.error("[send-test-email] RESEND_API_KEY or RESEND_FROM_EMAIL missing");
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY or RESEND_FROM_EMAIL is missing" },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: ["delivered@resend.dev"],
      subject: "Test Alternance Hunter + Resend",
      html: "<strong>Si tu vois cet email, Resend fonctionne depuis Vercel 🎉</strong>",
    });

    if (error) {
      console.error("Resend error", error);
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error("Resend exception", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}


