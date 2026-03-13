import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";

const INVITED_EMAILS_ENV_KEYS = ["AUTH_ALLOWED_EMAILS", "INVITED_EMAILS"] as const;

function parseAllowedEmails(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

function getAllowedEmails(): Set<string> {
  for (const key of INVITED_EMAILS_ENV_KEYS) {
    const parsed = parseAllowedEmails(process.env[key]);
    if (parsed.size > 0) {
      return parsed;
    }
  }
  return new Set();
}

type SessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

export type AuthorizedSession = {
  user: SessionUser;
  session: unknown;
};

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isInvitedEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  const allowedEmails = getAllowedEmails();
  return allowedEmails.has(normalized);
}

export async function requireApiAuthorizedSession(): Promise<
  | { ok: true; value: AuthorizedSession }
  | { ok: false; response: NextResponse<{ detail: string }> }
> {
  const session = await getServerSession();
  const user = (session?.user ?? null) as SessionUser | null;

  if (!session || !user?.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { detail: "Authentication required. Connectez-vous pour continuer." },
        { status: 401 },
      ),
    };
  }

  if (!isInvitedEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { detail: "Access denied. Votre email n'est pas autorise." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, value: { session, user } };
}
