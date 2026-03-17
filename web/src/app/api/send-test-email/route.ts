import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL as string,
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

