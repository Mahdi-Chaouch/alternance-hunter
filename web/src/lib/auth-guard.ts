import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import { isInvitedEmail as isInvitedEmailDb } from "@/lib/invited-emails";

type SessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

export type AuthorizedSession = {
  user: SessionUser;
  session: unknown;
};

export async function isInvitedEmail(email: string | null | undefined): Promise<boolean> {
  return isInvitedEmailDb(email);
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

  if (!(await isInvitedEmailDb(user.email))) {
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
