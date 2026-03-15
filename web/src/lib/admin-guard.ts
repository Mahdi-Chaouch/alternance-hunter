import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

type SessionUser = { email?: string | null };

export async function requireAdminSession(): Promise<
  | { ok: true; email: string }
  | { ok: false; response: NextResponse<{ detail: string }> }
> {
  const session = await getServerSession();
  const user = (session?.user ?? null) as SessionUser | null;
  const email = (user?.email ?? "").trim().toLowerCase();

  if (!session || !email) {
    return {
      ok: false,
      response: NextResponse.json(
        { detail: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  if (!ADMIN_EMAIL) {
    return {
      ok: false,
      response: NextResponse.json(
        { detail: "Admin access is not configured." },
        { status: 403 },
      ),
    };
  }

  if (email !== ADMIN_EMAIL) {
    return {
      ok: false,
      response: NextResponse.json(
        { detail: "Access denied. Admin only." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, email };
}
