import { isProduction } from "./env";

const DEV_FALLBACK_BASE_URL = "http://127.0.0.1:8000";

export function getBackendConfig(): { baseUrl: string; token: string } {
  const baseUrl =
    (process.env.PIPELINE_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").trim() ||
    (!isProduction ? DEV_FALLBACK_BASE_URL : "");
  const token = (
    process.env.PIPELINE_API_TOKEN ?? process.env.API_TOKEN ??
    ""
  ).trim();

  if (isProduction) {
    if (!baseUrl) {
      throw new Error(
        "[Production] Set PIPELINE_API_BASE_URL or NEXT_PUBLIC_API_URL in your environment.",
      );
    }
    if (!token) {
      throw new Error(
        "[Production] Set PIPELINE_API_TOKEN or API_TOKEN in your environment.",
      );
    }
  }

  return {
    baseUrl: baseUrl || DEV_FALLBACK_BASE_URL,
    token: token || "",
  };
}

export function getAuthHeaders(token: string): HeadersInit {
  if (!token) {
    return {};
  }

  return { "x-api-token": token };
}
