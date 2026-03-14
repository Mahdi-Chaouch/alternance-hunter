import { createAuthClient } from "better-auth/react";

function normalizeBaseUrl(url: string): string {
  const s = (url || "").trim();
  if (!s) return "http://localhost:3000";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

export const authClient = createAuthClient({
  baseURL: normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000"
  ),
});
