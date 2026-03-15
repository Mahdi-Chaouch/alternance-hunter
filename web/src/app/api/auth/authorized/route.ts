import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireApiAuthorizedSession } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import type { GoogleLinkedAccount } from "@/lib/google-oauth-context";

function hasRequiredGmailScopes(scopes: string[]): boolean {
  const required = [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.readonly",
  ] as const;
  return required.every((s) => scopes.includes(s));
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
    })) as GoogleLinkedAccount[];
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
