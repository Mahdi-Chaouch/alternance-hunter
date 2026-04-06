import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getBackendConfig } from "@/lib/backend";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { resolveGoogleOAuthContextForSync } from "@/lib/google-oauth-context";
import { getUserProfile } from "@/lib/user-profile";
import { readJsonSafely } from "@/lib/http";

function buildUserScopedHeaders(user: { id?: string; email?: string | null }): HeadersInit {
  const h: Record<string, string> = {};
  if (user.id?.trim()) h["x-run-user-id"] = user.id.trim();
  if (user.email?.trim()) h["x-run-user-email"] = user.email.trim().toLowerCase();
  return h;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { user } = authResult.value;
  const userId = user.id?.trim() ?? "";

  // Resolve Gmail OAuth tokens
  const oauthResult = await resolveGoogleOAuthContextForSync();
  if (!oauthResult.ok) {
    return oauthResult.response;
  }

  // Load user profile for sender info + email templates
  const profile = await getUserProfile(userId);

  const body = (await request.json().catch(() => ({}))) as {
    company_name?: string;
    contact_email?: string;
  };

  if (!body.company_name) {
    return NextResponse.json({ detail: "company_name est requis." }, { status: 400 });
  }

  const payload = {
    company_name: body.company_name,
    contact_email: body.contact_email,
    sender_first_name: profile?.first_name ?? "",
    sender_last_name: profile?.last_name ?? "",
    sender_linkedin_url: profile?.linkedin_url ?? "",
    sender_portfolio_url: profile?.portfolio_url ?? "",
    mail_subject_template: profile?.subject_template ?? "",
    mail_body_template: profile?.body_template ?? "",
    ...oauthResult.payload,
  };

  try {
    const { baseUrl, token } = getBackendConfig();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/recruiting/quick-draft`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(token),
        ...buildUserScopedHeaders(user),
      },
      body: JSON.stringify(payload),
    });
    const data = await readJsonSafely(response);
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Backend inaccessible: ${message}` }, { status: 503 });
  }
}
