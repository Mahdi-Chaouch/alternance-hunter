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

const ALLOWED_MODES = new Set(["pipeline", "hunter", "generate", "drafts"]);
const ALLOWED_ZONES = null;

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
        portfolio_url: "",
        subject_template: "",
        body_template: "",
        run_mode: "pipeline",
        run_zone: "all",
        run_sector: "it",
        run_dry_run: false,
        run_max_minutes: 30,
        run_max_sites: 1500,
        run_target_found: 100,
        run_workers: 20,
        run_use_ai: false,
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
    portfolio_url?: string;
    subject_template?: string;
    body_template?: string;
    run_mode?: string;
    run_zone?: string;
    run_sector?: string;
    run_dry_run?: boolean;
    run_max_minutes?: number;
    run_max_sites?: number;
    run_target_found?: number;
    run_workers?: number;
    run_use_ai?: boolean;
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
  const portfolioUrl = (payload.portfolio_url ?? "").trim();
  const subjectTemplate = payload.subject_template ?? "";
  const bodyTemplate = payload.body_template ?? "";
  const runMode = (payload.run_mode ?? "pipeline").toLowerCase();
  const runZone = (payload.run_zone ?? "all").toString();
  const runSector = (payload.run_sector ?? "it").toString().toLowerCase();
  const runDryRun = payload.run_dry_run === true;
  const runMaxMinutes = Number(payload.run_max_minutes ?? 30);
  const runMaxSites = Number(payload.run_max_sites ?? 1500);
  const runTargetFound = Number(payload.run_target_found ?? 100);
  const runWorkers = Number(payload.run_workers ?? 20);
  const runUseAi = payload.run_use_ai === true;

  if (!ALLOWED_MODES.has(runMode)) {
    return NextResponse.json({ detail: "Mode pipeline invalide." }, { status: 400 });
  }
  if (runZone.length > 200) {
    return NextResponse.json({ detail: "Zone trop longue." }, { status: 400 });
  }
  if (
    Number.isNaN(runMaxMinutes) ||
    Number.isNaN(runMaxSites) ||
    Number.isNaN(runTargetFound) ||
    Number.isNaN(runWorkers)
  ) {
    return NextResponse.json({ detail: "Parametres numeriques invalides." }, { status: 400 });
  }
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
    portfolioUrl,
    subjectTemplate,
    bodyTemplate,
    runMode,
    runZone,
    runSector,
    runDryRun,
    runMaxMinutes,
    runMaxSites,
    runTargetFound,
    runWorkers,
    runUseAi,
  });
  return NextResponse.json({
    ok: true,
    profile,
    profile_completed:
      profile.first_name.trim().length > 0 && profile.last_name.trim().length > 0,
  });
}
