import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { getUserProfile, upsertUserProfile } from "@/lib/user-profile";

function splitName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const normalized = (fullName ?? "").trim();
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export async function GET(): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const userId = authResult.value.user.id?.trim();
  const userEmail = authResult.value.user.email?.trim().toLowerCase() ?? "";
  if (!userId) {
    return NextResponse.json({ detail: "Session utilisateur invalide." }, { status: 400 });
  }

  const profile = await getUserProfile(userId);
  if (!profile) {
    const name = splitName(authResult.value.user.name);
    return NextResponse.json({
      profile: {
        first_name: name.firstName,
        last_name: name.lastName,
        linkedin_url: "",
        subject_template: "",
        body_template: "",
      },
      profile_completed: name.firstName.length > 0 && name.lastName.length > 0,
      email: userEmail,
    });
  }

  return NextResponse.json({
    profile,
    profile_completed:
      profile.first_name.trim().length > 0 && profile.last_name.trim().length > 0,
    email: userEmail,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const userId = authResult.value.user.id?.trim();
  const userEmail = authResult.value.user.email?.trim().toLowerCase() ?? "";
  if (!userId || !userEmail) {
    return NextResponse.json({ detail: "Session utilisateur invalide." }, { status: 400 });
  }

  const payload = (await request.json()) as {
    first_name?: string;
    last_name?: string;
    linkedin_url?: string;
    subject_template?: string;
    body_template?: string;
  };

  const firstName = (payload.first_name ?? "").trim();
  const lastName = (payload.last_name ?? "").trim();
  if (!firstName || !lastName) {
    return NextResponse.json(
      { detail: "Le prenom et le nom sont requis pour personnaliser les mails." },
      { status: 400 },
    );
  }

  const linkedinUrl = (payload.linkedin_url ?? "").trim();
  const subjectTemplate = payload.subject_template ?? "";
  const bodyTemplate = payload.body_template ?? "";
  if (subjectTemplate.length > 300 || bodyTemplate.length > 8000) {
    return NextResponse.json(
      { detail: "Template trop long. Reduisez le sujet ou le corps du mail." },
      { status: 400 },
    );
  }

  const profile = await upsertUserProfile(userId, userEmail, {
    firstName,
    lastName,
    linkedinUrl,
    subjectTemplate,
    bodyTemplate,
  });
  return NextResponse.json({
    ok: true,
    profile,
    profile_completed:
      profile.first_name.trim().length > 0 && profile.last_name.trim().length > 0,
  });
}
