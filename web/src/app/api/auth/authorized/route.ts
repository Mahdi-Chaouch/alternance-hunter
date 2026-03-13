import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";

const REQUIRED_GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.compose"] as const;

type AccountSummary = {
  providerId?: string;
  scopes?: string[];
};

function hasRequiredGmailScopes(scopes: string[]): boolean {
  return REQUIRED_GMAIL_SCOPES.every((requiredScope) => scopes.includes(requiredScope));
}

export async function GET(): Promise<NextResponse> {
  const authResult = await requireApiAuthorizedSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  let gmailConnected = false;
  let googleAccountLinked = false;

  try {
    const linkedAccounts = (await auth.api.listUserAccounts({
      headers: await headers(),
    })) as AccountSummary[];
    const googleAccount = linkedAccounts.find((account) => account.providerId === "google");
    googleAccountLinked = Boolean(googleAccount);
    gmailConnected = Boolean(googleAccount && hasRequiredGmailScopes(googleAccount.scopes ?? []));
  } catch {
    gmailConnected = false;
    googleAccountLinked = false;
  }

  return NextResponse.json({
    authorized: true,
    email: authResult.value.user.email ?? null,
    gmail_connected: gmailConnected,
    google_account_linked: googleAccountLinked,
  });
}
